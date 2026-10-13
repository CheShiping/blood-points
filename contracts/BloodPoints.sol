// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice 平台合约调用的积分代币接口（铸造/销毁）
interface IBloodPointToken {
  function mint(address to, uint256 amount) external;
  function burnFrom(address account, uint256 amount) external;
}

/// @title BloodPoints（热血链 · 无偿献血公益透明追踪平台）
/// @notice 选题适配：「公益捐赠透明追踪平台」——捐赠者（献血者）的每一次捐赠
///         按里程碑状态机（献血 -> 血站接收 -> 实验室检测 -> 医院分配）分阶段推进，
///         每个阶段的操作人、机构与 IPFS 凭证哈希全部上链公示，血液流向全程可查；
///         捐赠奖励以 ERC20 积分代币 BloodPointToken 发放，商城兑换时链上销毁。
/// @dev 教学模拟项目，仅部署 Sepolia 测试网，不涉及真实资产。
contract BloodPoints is AccessControl, Pausable, ReentrancyGuard {
  // ==================== 角色定义 ====================

  /// @notice 采集记录员：线下采集献血信息并上链登记
  bytes32 public constant COLLECTOR_ROLE = keccak256("COLLECTOR_ROLE");

  /// @notice 血站工作人员：血站接收血液
  bytes32 public constant BLOOD_BANK_ROLE = keccak256("BLOOD_BANK_ROLE");

  /// @notice 检测实验室：血液质量检测并上传检测报告凭证
  bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");

  /// @notice 医院工作人员：将合格血液分配给病人
  bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");

  // ==================== 数据结构 ====================

  /// @notice 商品结构体
  struct Product {
    uint256 id;
    string name;
    uint256 price;
    uint256 stock;
  }

  /// @notice 血液里程碑阶段（状态机）
  enum BloodStatus { Donated, Received, Tested, Assigned }

  /// @notice 血液单元结构体
  struct BloodUnit {
    uint256 bloodId;
    address donor;
    uint256 volume;
    string bloodType;
    bool testedPassed;
    address patient;
    BloodStatus status;
    uint256 donatedAt;
    uint256 testedAt;
    uint256 assignedAt;
  }

  /// @notice 里程碑记录：每个阶段流转的操作人、机构与 IPFS 凭证哈希
  struct Milestone {
    BloodStatus stage; // 到达的阶段
    address operator; // 操作人钱包地址
    string location; // 机构名称（血站/实验室/医院）
    string evidence; // IPFS 凭证 CID（存证哈希）
    uint256 timestamp; // 上链时间
  }

  // ==================== 状态变量 ====================

  /// @notice 积分代币合约（ERC20 BloodPointToken）
  IERC20 public pointsToken;

  /// @notice 商品映射
  mapping(uint256 => Product) public products;

  /// @notice 下一个商品 ID
  uint256 public nextProductId;

  /// @notice 所有献血者地址列表（排行榜数据源）
  address[] public allDonors;

  /// @notice 是否为献血者的标记映射
  mapping(address => bool) public isDonor;

  /// @notice 每次献血获得的积分数量
  uint256 public constant POINTS_PER_DONATION = 100;

  /// @notice 血液ID到血液单元的映射
  mapping(uint256 => BloodUnit) public bloodUnits;

  /// @notice 血液ID到里程碑记录的映射（完整流转历史）
  mapping(uint256 => Milestone[]) internal _bloodMilestones;

  /// @notice 献血者地址到血液ID列表的映射
  mapping(address => uint256[]) public donorBloodIds;

  /// @notice 病人地址到收到的血液ID列表的映射
  mapping(address => uint256[]) public patientBloodIds;

  /// @notice 下一个血液ID
  uint256 public nextBloodId;

  /// @notice 血型到血液ID列表的映射
  mapping(string => uint256[]) internal _bloodIdsByType;

  /// @notice 所有血液ID列表
  uint256[] internal _allBloodIds;

  // ==================== 事件 ====================

  /// @notice 积分发放事件
  event PointsAwarded(address indexed donor, uint256 amount, uint256 indexed bloodId);

  /// @notice 里程碑上链事件（含 IPFS 凭证哈希，供链下公示与追溯）
  event MilestoneRecorded(
    uint256 indexed bloodId,
    BloodStatus stage,
    address indexed operator,
    string location,
    string evidence
  );

  /// @notice 血液创建事件
  event BloodCreated(uint256 indexed bloodId, address indexed donor, string bloodType, uint256 volume);

  /// @notice 血站接收事件
  event BloodReceived(uint256 indexed bloodId, string bloodBank, string evidence);

  /// @notice 血液检测事件
  event BloodTested(uint256 indexed bloodId, bool passed, string evidence);

  /// @notice 血液分配事件
  event BloodAssigned(uint256 indexed bloodId, address indexed patient, string evidence);

  /// @notice 商品上架事件
  event ProductAdded(uint256 indexed productId, string name, uint256 price, uint256 stock);

  /// @notice 商品兑换事件
  event ProductRedeemed(address indexed user, uint256 indexed productId, uint256 price);

  /// @notice 积分代币合约地址更新事件
  event PointsTokenUpdated(address indexed token);

  // ==================== 错误 ====================

  error TokenNotSet();
  error ZeroAddress();

  // ==================== 构造函数 ====================

  /// @notice 构造函数，设置平台管理员与积分代币合约
  /// @param admin 平台管理员地址（获得 DEFAULT_ADMIN_ROLE）
  /// @param token 积分代币合约地址（BloodPointToken）
  constructor(address admin, address token) {
    if (admin == address(0) || token == address(0)) revert ZeroAddress();
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    pointsToken = IERC20(token);
    emit PointsTokenUpdated(token);
  }

  // ==================== 管理员功能 ====================

  /// @notice 管理员更新积分代币合约地址
  /// @param token 新的积分代币合约地址
  function setPointsToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (token == address(0)) revert ZeroAddress();
    pointsToken = IERC20(token);
    emit PointsTokenUpdated(token);
  }

  /// @notice 管理员上架新商品
  /// @param name 商品名称
  /// @param price 商品价格（积分）
  /// @param stock 商品库存
  function addNewProduct(
    string calldata name,
    uint256 price,
    uint256 stock
  ) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(bytes(name).length > 0, "Product name cannot be empty");
    require(price > 0, "Price must be greater than 0");
    require(stock > 0, "Stock must be greater than 0");

    uint256 productId = nextProductId++;
    products[productId] = Product({
      id: productId,
      name: name,
      price: price,
      stock: stock
    });

    emit ProductAdded(productId, name, price, stock);
  }

  /// @notice 应急暂停：禁止献血登记与商城兑换（血液流转不受影响，保障临床用血不断档）
  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }

  /// @notice 恢复运营
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }

  // ==================== 献血登记（积分发放） ====================

  /// @notice 用户自助献血，获得 100 积分（ERC20 铸造）并创建血液追踪记录
  /// @param bloodType 血型 (A/B/AB/O)
  /// @param volume 献血量(ml)
  function donateBlood(string calldata bloodType, uint256 volume)
    external
    whenNotPaused
    nonReentrant
  {
    require(bytes(bloodType).length > 0, "Blood type cannot be empty");
    require(volume > 0, "Volume must be greater than 0");

    _createBlood(msg.sender, bloodType, volume, "", msg.sender);
    _awardPoints(msg.sender, nextBloodId - 1);
  }

  /// @notice 采集记录员代录献血记录，为献血者发放 100 积分
  /// @param donor 献血者地址
  /// @param bloodType 血型 (A/B/AB/O)
  /// @param volume 献血量(ml)
  /// @param evidence 献血登记凭证的 IPFS CID（哈希上链公示）
  function recordBlood(
    address donor,
    string calldata bloodType,
    uint256 volume,
    string calldata evidence
  ) external whenNotPaused nonReentrant onlyRole(COLLECTOR_ROLE) {
    require(donor != address(0), "Invalid donor address");
    require(bytes(bloodType).length > 0, "Blood type cannot be empty");
    require(volume > 0, "Volume must be greater than 0");

    _createBlood(donor, bloodType, volume, evidence, msg.sender);
    _awardPoints(donor, nextBloodId - 1);
  }

  // ==================== 血液里程碑流转 ====================

  /// @notice 血站接收血液（里程碑：Donated -> Received）
  /// @param bloodId 血液ID
  /// @param bloodBank 血站名称
  /// @param evidence 入库凭证的 IPFS CID（哈希上链公示）
  function receiveBlood(uint256 bloodId, string calldata bloodBank, string calldata evidence)
    external
    onlyRole(BLOOD_BANK_ROLE)
  {
    BloodUnit storage unit = bloodUnits[bloodId];
    require(unit.bloodId == bloodId, "Blood unit does not exist");
    require(unit.status == BloodStatus.Donated, "Blood cannot be received in current status");
    require(bytes(bloodBank).length > 0, "Blood bank name cannot be empty");

    unit.status = BloodStatus.Received;
    _recordMilestone(bloodId, BloodStatus.Received, msg.sender, bloodBank, evidence);

    emit BloodReceived(bloodId, bloodBank, evidence);
  }

  /// @notice 检测实验室检测血液（里程碑：Received -> Tested）
  /// @param bloodId 血液ID
  /// @param passed 检测是否合格
  /// @param evidence 检测报告的 IPFS CID（哈希上链公示）
  function testBlood(uint256 bloodId, bool passed, string calldata evidence)
    external
    onlyRole(LAB_ROLE)
  {
    BloodUnit storage unit = bloodUnits[bloodId];
    require(unit.bloodId == bloodId, "Blood unit does not exist");
    require(unit.status == BloodStatus.Received, "Blood must be received before testing");

    unit.status = BloodStatus.Tested;
    unit.testedPassed = passed;
    unit.testedAt = block.timestamp;
    _recordMilestone(bloodId, BloodStatus.Tested, msg.sender, unicode"检测实验室", evidence);

    emit BloodTested(bloodId, passed, evidence);
  }

  /// @notice 医院分配血液给病人（里程碑：Tested -> Assigned，仅检测合格）
  /// @param bloodId 血液ID
  /// @param patientAddress 病人地址
  /// @param evidence 用血分配凭证的 IPFS CID（哈希上链公示）
  function assignToPatient(uint256 bloodId, address patientAddress, string calldata evidence)
    external
    onlyRole(HOSPITAL_ROLE)
  {
    BloodUnit storage unit = bloodUnits[bloodId];
    require(unit.bloodId == bloodId, "Blood unit does not exist");
    require(unit.status == BloodStatus.Tested, "Blood must be tested before assignment");
    require(unit.testedPassed, "Blood test must pass before assignment");
    require(patientAddress != address(0), "Invalid patient address");

    unit.status = BloodStatus.Assigned;
    unit.patient = patientAddress;
    unit.assignedAt = block.timestamp;
    patientBloodIds[patientAddress].push(bloodId);
    _recordMilestone(bloodId, BloodStatus.Assigned, msg.sender, unicode"医院", evidence);

    emit BloodAssigned(bloodId, patientAddress, evidence);
  }

  // ==================== 商城兑换（积分销毁） ====================

  /// @notice 积分兑换商品（遵循 Checks-Effects-Interactions 并附加 nonReentrant）
  /// @param productId 要兑换的商品 ID
  function redeemProduct(uint256 productId) external whenNotPaused nonReentrant {
    // Checks
    Product storage product = products[productId];
    require(product.price > 0, "Product does not exist");
    require(product.stock > 0, "Product out of stock");
    if (address(pointsToken) == address(0)) revert TokenNotSet();
    require(
      pointsToken.balanceOf(msg.sender) >= product.price,
      "Insufficient points"
    );

    // Effects
    product.stock -= 1;

    // Interactions：通过平台合约销毁积分
    IBloodPointToken(address(pointsToken)).burnFrom(msg.sender, product.price);

    emit ProductRedeemed(msg.sender, productId, product.price);
  }

  // ==================== 查询功能 ====================

  /// @notice 查询用户积分余额（读取 ERC20 代币）
  /// @param user 用户地址
  /// @return 该用户的积分余额
  function getPoints(address user) external view returns (uint256) {
    return _pointsOf(user);
  }

  /// @dev 内部积分查询：代币未设置时返回 0
  function _pointsOf(address user) internal view returns (uint256) {
    if (address(pointsToken) == address(0)) return 0;
    return pointsToken.balanceOf(user);
  }

  /// @notice 查询商品详情
  /// @param productId 商品 ID
  /// @return id 商品 ID
  /// @return name 商品名称
  /// @return price 商品价格
  /// @return stock 商品库存
  function getProduct(uint256 productId)
    external
    view
    returns (uint256 id, string memory name, uint256 price, uint256 stock)
  {
    Product storage product = products[productId];
    return (product.id, product.name, product.price, product.stock);
  }

  /// @notice 查询血液单元详情
  /// @param bloodId 血液ID
  /// @return 血液单元完整信息
  function getBloodUnit(uint256 bloodId) external view returns (BloodUnit memory) {
    require(bloodUnits[bloodId].bloodId == bloodId, "Blood unit does not exist");
    return bloodUnits[bloodId];
  }

  /// @notice 查询血液的完整里程碑流转记录（含 IPFS 凭证哈希）
  /// @param bloodId 血液ID
  /// @return 里程碑记录数组
  function getMilestones(uint256 bloodId) external view returns (Milestone[] memory) {
    require(bloodUnits[bloodId].bloodId == bloodId, "Blood unit does not exist");
    return _bloodMilestones[bloodId];
  }

  /// @notice 一站式查询血液完整流转信息
  /// @param bloodId 血液ID
  /// @return unit 血液单元信息
  /// @return milestones 里程碑流转记录
  function getBloodJourney(uint256 bloodId)
    external
    view
    returns (BloodUnit memory unit, Milestone[] memory milestones)
  {
    require(bloodUnits[bloodId].bloodId == bloodId, "Blood unit does not exist");
    return (bloodUnits[bloodId], _bloodMilestones[bloodId]);
  }

  /// @notice 查询献血者的所有血液ID
  /// @param donor 献血者地址
  /// @return 血液ID数组
  function getDonorBloods(address donor) external view returns (uint256[] memory) {
    return donorBloodIds[donor];
  }

  /// @notice 查询病人收到的所有血液ID
  /// @param patient 病人地址
  /// @return 血液ID数组
  function getPatientBloods(address patient) external view returns (uint256[] memory) {
    return patientBloodIds[patient];
  }

  /// @notice 按血型查询血液ID列表
  /// @param bloodType 血型
  /// @return 血液ID数组
  function getBloodsByType(string calldata bloodType) external view returns (uint256[] memory) {
    return _bloodIdsByType[bloodType];
  }

  /// @notice 查询所有血液ID
  /// @return 血液ID数组
  function getAllBloodIds() external view returns (uint256[] memory) {
    return _allBloodIds;
  }

  /// @notice 按状态查询血液ID列表
  /// @param status 血液状态
  /// @return 血液ID数组
  function getBloodsByStatus(BloodStatus status) external view returns (uint256[] memory) {
    uint256 count = 0;
    for (uint256 i = 0; i < _allBloodIds.length; i++) {
      if (bloodUnits[_allBloodIds[i]].status == status) {
        count++;
      }
    }
    uint256[] memory result = new uint256[](count);
    uint256 idx = 0;
    for (uint256 i = 0; i < _allBloodIds.length; i++) {
      if (bloodUnits[_allBloodIds[i]].status == status) {
        result[idx++] = _allBloodIds[i];
      }
    }
    return result;
  }

  /// @notice 获取公益排行榜（按积分降序）
  /// @dev 返回所有献血者及其积分余额，规模大时 gas 较高，教学规模可接受
  /// @return donors 献血者地址数组
  /// @return points 对应的积分数组
  function getLeaderboard()
    external
    view
    returns (address[] memory donors, uint256[] memory points)
  {
    uint256 count = allDonors.length;

    donors = new address[](count);
    points = new uint256[](count);

    for (uint256 i = 0; i < count; i++) {
      donors[i] = allDonors[i];
      points[i] = _pointsOf(allDonors[i]);
    }

    // 冒泡排序按积分降序排列
    for (uint256 i = 0; i < count; i++) {
      for (uint256 j = i + 1; j < count; j++) {
        if (points[j] > points[i]) {
          (points[i], points[j]) = (points[j], points[i]);
          (donors[i], donors[j]) = (donors[j], donors[i]);
        }
      }
    }

    return (donors, points);
  }

  /// @notice 获取所有献血者数量
  /// @return 献血者总数
  function getDonorCount() external view returns (uint256) {
    return allDonors.length;
  }

  // ==================== 内部函数 ====================

  /// @dev 创建血液单元与首条里程碑（献血登记）
  function _createBlood(
    address donor,
    string memory bloodType,
    uint256 volume,
    string memory evidence,
    address operator
  ) internal {
    uint256 bloodId = nextBloodId++;
    bloodUnits[bloodId] = BloodUnit({
      bloodId: bloodId,
      donor: donor,
      volume: volume,
      bloodType: bloodType,
      testedPassed: false,
      patient: address(0),
      status: BloodStatus.Donated,
      donatedAt: block.timestamp,
      testedAt: 0,
      assignedAt: 0
    });

    if (!isDonor[donor]) {
      isDonor[donor] = true;
      allDonors.push(donor);
    }

    donorBloodIds[donor].push(bloodId);
    _bloodIdsByType[bloodType].push(bloodId);
    _allBloodIds.push(bloodId);
    _recordMilestone(bloodId, BloodStatus.Donated, operator, unicode"献血点", evidence);

    emit BloodCreated(bloodId, donor, bloodType, volume);
  }

  /// @dev 记录里程碑流转
  function _recordMilestone(
    uint256 bloodId,
    BloodStatus stage,
    address operator,
    string memory location,
    string memory evidence
  ) internal {
    _bloodMilestones[bloodId].push(Milestone({
      stage: stage,
      operator: operator,
      location: location,
      evidence: evidence,
      timestamp: block.timestamp
    }));

    emit MilestoneRecorded(bloodId, stage, operator, location, evidence);
  }

  /// @dev 通过 ERC20 平台合约为捐赠者铸造积分
  function _awardPoints(address donor, uint256 bloodId) internal {
    if (address(pointsToken) == address(0)) revert TokenNotSet();
    IBloodPointToken(address(pointsToken)).mint(donor, POINTS_PER_DONATION);
    emit PointsAwarded(donor, POINTS_PER_DONATION, bloodId);
  }
}
