// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BloodPointToken（热血积分代币）
/// @notice 教学模拟用 ERC20 积分代币：献血捐赠由平台合约按 100 积分/次铸造，
///         商城兑换时由平台合约销毁。仅用于《Web3技术应用》课程教学模拟，
///         不涉及任何真实资产或主网部署。
/// @dev 继承 OpenZeppelin 5.x 的 ERC20 / Ownable / Pausable。
///      - minter：唯一被授权的铸币与销毁调用方（应为 BloodPoints 平台合约）
///      - owner ：可更换 minter、可暂停/恢复全部转账（应急风控）
contract BloodPointToken is ERC20, Ownable, Pausable {
  /// @notice 铸币/销毁权限地址（平台合约）
  address public minter;

  /// @notice minter 变更事件
  event MinterUpdated(address indexed previousMinter, address indexed newMinter);

  /// @notice 非 minter 调用
  error NotMinter(address caller);

  /// @notice 零地址错误
  error ZeroAddress();

  /// @notice 构造函数
  /// @param initialOwner 初始管理员地址
  /// @param initialMinter 初始铸币合约地址（BloodPoints 平台合约）
  constructor(address initialOwner, address initialMinter)
    ERC20("BloodPointToken", "BPT")
    Ownable(initialOwner)
  {
    if (initialMinter == address(0)) revert ZeroAddress();
    minter = initialMinter;
    emit MinterUpdated(address(0), initialMinter);
  }

  /// @dev 积分代币面向终端用户展示，使用 0 位小数（1 token = 1 积分）
  function decimals() public pure override returns (uint8) {
    return 0;
  }

  /// @notice 仅 minter 修饰器
  modifier onlyMinter() {
    if (msg.sender != minter) revert NotMinter(msg.sender);
    _;
  }

  // ==================== 管理员功能 ====================

  /// @notice 管理员更换 minter（如平台合约升级重新部署时）
  /// @param newMinter 新的铸币合约地址
  function setMinter(address newMinter) external onlyOwner {
    if (newMinter == address(0)) revert ZeroAddress();
    emit MinterUpdated(minter, newMinter);
    minter = newMinter;
  }

  /// @notice 管理员暂停全部转账（应急风控）
  function pause() external onlyOwner {
    _pause();
  }

  /// @notice 管理员恢复转账
  function unpause() external onlyOwner {
    _unpause();
  }

  // ==================== 平台功能 ====================

  /// @notice 平台合约为用户铸造积分（每次献血 100 积分）
  /// @param to 接收积分地址
  /// @param amount 铸造数量
  function mint(address to, uint256 amount) external onlyMinter {
    _mint(to, amount);
  }

  /// @notice 平台合约销毁用户积分（商城兑换时调用）
  /// @dev 教学模拟简化：minter 为受信任的平台合约，平台已在 redeemProduct 中
  ///     完成余额与库存校验（Checks-Effects-Interactions），故免去 allowance 授权流程。
  /// @param account 被销毁积分的用户
  /// @param amount 销毁数量
  function burnFrom(address account, uint256 amount) external onlyMinter {
    _burn(account, amount);
  }

  // ==================== 暂停钩子 ====================

  /// @dev 暂停期间禁止一切转账/铸造/销毁
  function _update(address from, address to, uint256 value)
    internal
    override
    whenNotPaused
  {
    super._update(from, to, value);
  }
}
