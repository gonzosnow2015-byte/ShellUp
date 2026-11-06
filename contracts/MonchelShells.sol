// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MonchelShells
/// @notice Timed locks. Only the recipient can claim, and only after unlockTime.
///         Creating a Shell stamps 25 $MONCHEL: half burns, half goes to promoWallet.
///         No function lets an admin move locked coins.
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MonchelShells {
    uint256 public constant STAMP = 25 ether;
    uint256 public constant MIN_LOCK = 1 hours;
    uint256 public constant NOTE_MAX = 140;
    address public constant MONCHEL = 0xB6842737e2a6d5a92aBA03eD0CCA578303E87777;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    address public immutable promoWallet;

    struct Shell {
        address token;
        address sender;
        address recipient;
        uint256 amount;
        uint256 unlockTime;
        bool claimed;
        string note;
    }

    Shell[] private shells;
    uint256 private entered;

    event ShellCreated(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 unlockTime
    );
    event ShellClaimed(uint256 indexed id, address indexed recipient);

    modifier nonReentrant() {
        require(entered == 0, "reenter");
        entered = 1;
        _;
        entered = 0;
    }

    /// @param promoWallet_ Receives half of every stamp. Set once, at deploy.
    constructor(address promoWallet_) {
        require(promoWallet_ != address(0) && promoWallet_ != address(this), "promo");
        promoWallet = promoWallet_;
    }

    /// @notice Lock MON (msg.value) for recipient until unlockTime.
    function createNative(address recipient, uint256 unlockTime, string calldata note)
        external
        payable
        nonReentrant
        returns (uint256 id)
    {
        require(msg.value > 0, "amount");
        _check(recipient, unlockTime, note);
        _stamp();
        id = _lock(address(0), recipient, msg.value, unlockTime, note);
    }

    /// @notice Lock an exact ERC-20 amount. Fee-on-transfer tokens are rejected.
    function createERC20(
        address token,
        uint256 amount,
        address recipient,
        uint256 unlockTime,
        string calldata note
    ) external nonReentrant returns (uint256 id) {
        require(token != address(0), "token");
        require(amount > 0, "amount");
        _check(recipient, unlockTime, note);
        _stamp();
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        _transferFrom(token, msg.sender, address(this), amount);
        require(IERC20(token).balanceOf(address(this)) - beforeBal == amount, "fee");
        id = _lock(token, recipient, amount, unlockTime, note);
    }

    /// @notice Recipient claims after unlockTime. Marked claimed before coins move.
    function claim(uint256 id) external nonReentrant {
        require(id < shells.length, "id");
        Shell storage shell = shells[id];
        require(msg.sender == shell.recipient, "who");
        require(block.timestamp >= shell.unlockTime, "early");
        require(!shell.claimed, "claimed");
        shell.claimed = true;
        if (shell.token == address(0)) {
            (bool ok,) = msg.sender.call{value: shell.amount}("");
            require(ok, "transfer");
        } else {
            _transfer(shell.token, msg.sender, shell.amount);
        }
        emit ShellClaimed(id, msg.sender);
    }

    function getShell(uint256 id) external view returns (Shell memory) {
        require(id < shells.length, "id");
        return shells[id];
    }

    function shellCount() external view returns (uint256) {
        return shells.length;
    }

    receive() external payable {
        revert("amount");
    }

    function _check(address recipient, uint256 unlockTime, string calldata note) private view {
        require(recipient != address(0), "recipient");
        require(unlockTime >= block.timestamp + MIN_LOCK, "unlock");
        require(bytes(note).length <= NOTE_MAX, "note");
    }

    /// @dev Pull 25 $MONCHEL, then send it all out before any locked balance is measured.
    function _stamp() private {
        uint256 beforeBal = IERC20(MONCHEL).balanceOf(address(this));
        _transferFrom(MONCHEL, msg.sender, address(this), STAMP);
        require(IERC20(MONCHEL).balanceOf(address(this)) - beforeBal == STAMP, "stamp");
        uint256 half = STAMP / 2;
        _transfer(MONCHEL, BURN, half);
        _transfer(MONCHEL, promoWallet, STAMP - half);
    }

    function _lock(
        address token,
        address recipient,
        uint256 amount,
        uint256 unlockTime,
        string calldata note
    ) private returns (uint256 id) {
        id = shells.length;
        shells.push(
            Shell({
                token: token,
                sender: msg.sender,
                recipient: recipient,
                amount: amount,
                unlockTime: unlockTime,
                claimed: false,
                note: note
            })
        );
        emit ShellCreated(id, msg.sender, recipient, token, amount, unlockTime);
    }

    function _transferFrom(address token, address from, address to, uint256 amount) private {
        _call(token, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
    }

    function _transfer(address token, address to, uint256 amount) private {
        _call(token, abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    /// @dev Accepts standard bool returns and tokens that return nothing.
    function _call(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        require(ok, "transfer");
        if (ret.length > 0) {
            require(abi.decode(ret, (bool)), "transfer");
        }
    }
}
