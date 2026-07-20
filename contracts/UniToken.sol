// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title UniToken (UDT) — governance token for UniDAO
/// @notice ERC-20 with a fixed supply cap and a transfer whitelist. No tokens are minted
///         at deploy; supply is created on demand up to `cap`. Ownership is expected to be
///         held by the UniDAO contract, the only caller of the owner-gated
///         mint / burn / whitelist functions.
/// @dev Ownership uses the two-step flow (Ownable2Step) and renouncing is disabled,
///      because losing ownership would leave mint/burn/whitelist permanently unreachable.
contract UniToken is ERC20, ERC20Permit, Ownable2Step {
    /// @notice Hard ceiling on total supply. Set once at deploy, never changeable.
    uint256 public immutable cap;

    mapping(address => bool) private _whitelist;

    event WhitelistUpdated(address indexed account, bool allowed);
    /// @dev Distinguishes an owner-initiated burn from a normal Transfer-to-zero in logs.
    event AdminBurn(address indexed from, uint256 amount);

    error NotWhitelisted(address account);
    error TransferRestricted(address from, address to);
    error CapExceeded(uint256 attempted, uint256 cap);
    error OwnershipRenounceDisabled();
    error InvalidCap();

    constructor(uint256 _cap)
        ERC20("Uni DAO Token", "UDT")
        // The name below is the EIP-712 domain name for permit(); it must match the
        // `name` field used when signing off-chain, or signature recovery fails.
        ERC20Permit("Uni DAO Token")
        Ownable(msg.sender)
    {
        // No initial supply: UDT is minted on demand (member grants, registrar mints,
        // treasury via vote fees) up to `cap`. Nothing is pre-allocated to the deployer.
        if (_cap == 0) revert InvalidCap();
        cap = _cap;
        // Whitelist the deployer so UDT can be minted to it later if ever needed; harmless
        // otherwise, and the deployer is the bootstrap owner until ownership moves to the DAO.
        _whitelist[msg.sender] = true;
    }

    /// @notice Mint new UDT to a whitelisted account, up to `cap`.
    /// @dev The whitelist is checked here (not in _update) because _update skips mints.
    function mint(address to, uint256 amount) external onlyOwner {
        if (!_whitelist[to]) revert NotWhitelisted(to);
        uint256 newSupply = totalSupply() + amount;
        if (newSupply > cap) revert CapExceeded(newSupply, cap);
        _mint(to, amount);
    }

    /// @notice Owner-only burn from any holder. Unrestricted admin power over balances,
    ///         used to reclaim tokens from a removed member. Intentionally not allowance-gated.
    function adminBurn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit AdminBurn(from, amount);
    }

    function setWhitelisted(address account, bool allowed) external onlyOwner {
        _whitelist[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    function setWhitelistedBatch(address[] calldata accounts, bool allowed) external onlyOwner {
        uint256 len = accounts.length;
        for (uint256 i = 0; i < len; i++) {
            _whitelist[accounts[i]] = allowed;
            emit WhitelistUpdated(accounts[i], allowed);
        }
    }

    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }

    /// @dev Permanently disabled — see contract-level note.
    function renounceOwnership() public pure override {
        revert OwnershipRenounceDisabled();
    }

    /// @dev Single interception point for every token movement in OZ v5. The zero-address
    ///      guard exempts mints (from == 0) and burns (to == 0) from the whitelist, so only
    ///      wallet-to-wallet transfers are restricted.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            if (!_whitelist[from] || !_whitelist[to]) revert TransferRestricted(from, to);
        }
        super._update(from, to, value);
    }
}
