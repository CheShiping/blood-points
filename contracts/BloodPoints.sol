// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BloodPoints is Ownable, ReentrancyGuard {
  // ==================== 数据结构 ====================

  /// @notice 商品结构体
  struct Product {
    uint256 id;
    string name;
    uint256 price;
    uint256 stock;
  }

  /// @notice 血液状态枚举
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

  /// @notice 血站流转记录
  struct BloodTransfer {
    string bloodBank;
    uint256 receivedAt;
    uint256 transferredAt;
  }

  // ==================== 状态变量 ====================

  /// @notice 用户积分映射
  mapping(address => uint256) public userPoints;

  /// @notice 商品映射
  mapping(uint256 => Product) public products;

  /// @notice 所有献血者地址列表
  address[] public allDonors;

  /// @notice 是否为献血者的标记映射
  mapping(address => bool) public isDonor;

  /// @notice 下一个商品 ID
  uint256 public nextProductId;

  /// @notice 每次献血获得的积分
  uint256 public constant POINTS_PER_DONATION = 100;

  /// @notice 血液ID到血液单元的映射
  mapping(uint256 => BloodUnit) public bloodUnits;

  /// @notice 血液ID到血站流转记录的映射
  mapping(uint256 => BloodTransfer[]) public bloodTransfers;

  /// @notice 献血者地址到血液ID列表的映射
  mapping(address => uint256[]) public donorBloodIds;

  /// @notice 病人地址到收到的血液ID列表的映射
  mapping(address => uint256[]) public patientBloodIds;

  /// @notice 下一个血液ID
  uint256 public nextBloodId;

  // ==================== 事件 ====================

  /// @notice 积分发放事件
  event PointsAwarded(address indexed user, uint256 amount);

  /// @notice 商品兑换事件
  event ProductRedeemed(address indexed user, uint256 productId);

  /// @notice 积分转赠事件
  event PointsTransferred(address indexed from, address indexed to, uint256 amount);

  /// @notice 血液创建事件
  event BloodCreated(uint256 indexed bloodId, address indexed donor, string bloodType, uint256 volume);

  /// @notice 血站接收事件
  event BloodReceived(uint256 indexed bloodId, string bloodBank, uint256 timestamp);

  /// @notice 血液检测事件
  event BloodTested(uint256 indexed bloodId, bool passed, uint256 timestamp);

  /// @notice 血液分配事件
  event BloodAssigned(uint256 indexed bloodId, address indexed patient, uint256 timestamp);

  // ==================== 构造函数 ====================

  /// @notice 构造函数，设置合约拥有者
  /// @param initialOwner 初始管理员地址
  constructor(address initialOwner) Ownable(initialOwner) {}

  // ==================== 献血积分功能 ====================

  /// @notice 用户献血获取积分
  /// @param bloodType 血型 (A/B/AB/O)
  /// @param volume 献血量(ml)
  function donateBlood(string calldata bloodType, uint256 volume) external nonReentrant {
    require(bytes(bloodType).length > 0, "Blood type cannot be empty");
    require(volume > 0, "Volume must be greater than 0");

    // 发放积分
    userPoints[msg.sender] += POINTS_PER_DONATION;

    // 如果是首次献血，记录到献血者列表
    if (!isDonor[msg.sender]) {
      isDonor[msg.sender] = true;
      allDonors.push(msg.sender);
    }

    // 创建血液追踪记录
    uint256 bloodId = nextBloodId++;
    bloodUnits[bloodId] = BloodUnit({
      bloodId: bloodId,
      donor: msg.sender,
      volume: volume,
      bloodType: bloodType,
      testedPassed: false,
      patient: address(0),
      status: BloodStatus.Donated,
      donatedAt: block.timestamp,
      testedAt: 0,
      assignedAt: 0
    });
    donorBloodIds[msg.sender].push(bloodId);

    emit PointsAwarded(msg.sender, POINTS_PER_DONATION);
    emit BloodCreated(bloodId, msg.sender, bloodType, volume);
  }

  // ==================== 积分转赠功能 ====================

  /// @notice 用户间积分转赠
  /// @param to 接收积分的地址
  /// @param amount 转赠的积分数量
  function transferPoints(address to, uint256 amount) external nonReentrant {
    // 验证不能转给自己
    require(to != msg.sender, "Cannot transfer to yourself");
    // 验证接收地址非零
    require(to != address(0), "Invalid recipient address");
    // 验证转赠数量大于零
    require(amount > 0, "Amount must be greater than 0");
    // 验证积分余额充足
    require(userPoints[msg.sender] >= amount, "Insufficient points");

    // 扣除发送者积分
    userPoints[msg.sender] -= amount;
    // 增加接收者积分
    userPoints[to] += amount;

    emit PointsTransferred(msg.sender, to, amount);
  }

  // ==================== 商品管理功能 ====================

  /// @notice 管理员上架新商品
  /// @param name 商品名称
  /// @param price 商品价格（积分）
  /// @param stock 商品库存
  function addNewProduct(
    string calldata name,
    uint256 price,
    uint256 stock
  ) external onlyOwner {
    // 验证商品名称非空
    require(bytes(name).length > 0, "Product name cannot be empty");
    // 验证价格大于零
    require(price > 0, "Price must be greater than 0");
    // 验证库存大于零
    require(stock > 0, "Stock must be greater than 0");

    // 创建商品并存储
    uint256 productId = nextProductId++;
    products[productId] = Product({
      id: productId,
      name: name,
      price: price,
      stock: stock
    });
  }

  /// @notice 积分兑换商品
  /// @param productId 要兑换的商品 ID
  function redeemProduct(uint256 productId) external nonReentrant {
    Product storage product = products[productId];

    // 验证商品存在（通过检查价格是否大于零来判断）
    require(product.price > 0, "Product does not exist");
    // 验证库存充足
    require(product.stock > 0, "Product out of stock");
    // 验证用户积分充足
    require(userPoints[msg.sender] >= product.price, "Insufficient points");

    // 扣除用户积分
    userPoints[msg.sender] -= product.price;
    // 减少商品库存
    product.stock -= 1;

    emit ProductRedeemed(msg.sender, productId);
  }

  // ==================== 排行榜查询功能 ====================

  /// @notice 获取公益排行榜
  /// @dev 返回所有献血者及其积分，按积分降序排列
  /// @return donors 献血者地址数组
  /// @return points 对应的积分数组
  function getLeaderboard()
    external
    view
    returns (address[] memory donors, uint256[] memory points)
  {
    uint256 count = allDonors.length;

    // 创建返回数组
    donors = new address[](count);
    points = new uint256[](count);

    // 复制数据
    for (uint256 i = 0; i < count; i++) {
      donors[i] = allDonors[i];
      points[i] = userPoints[allDonors[i]];
    }

    // 使用冒泡排序按积分降序排列
    for (uint256 i = 0; i < count; i++) {
      for (uint256 j = i + 1; j < count; j++) {
        if (points[j] > points[i]) {
          // 交换积分
          (points[i], points[j]) = (points[j], points[i]);
          // 交换地址
          (donors[i], donors[j]) = (donors[j], donors[i]);
        }
      }
    }

    return (donors, points);
  }

  // ==================== 查询功能 ====================

  /// @notice 查询用户积分余额
  /// @param user 用户地址
  /// @return 该用户的积分余额
  function getPoints(address user) external view returns (uint256) {
    return userPoints[user];
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
    returns (
      uint256 id,
      string memory name,
      uint256 price,
      uint256 stock
    )
  {
    Product storage product = products[productId];
    return (product.id, product.name, product.price, product.stock);
  }

  /// @notice 获取所有献血者数量
  /// @return 献血者总数
  function getDonorCount() external view returns (uint256) {
    return allDonors.length;
  }
}
