// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice TalentScout 的只读接口 —— ProfileRegistry 用它校验"谁有权写这张卡的简历"
interface ITalentScout {
    struct Candidate {
        address owner;
        string name;
        string tagline;
        string skills;
        string links;
        uint8 theme;
        uint32 votes;
        uint256 tips;
        uint32 msgCount;
        uint32 interestCount;
        bool recommended;
    }
    function getCandidate(uint256 id) external view returns (Candidate memory);
}

/// @title ProfileRegistry —— 链上简历登记处
/// @notice 自荐卡的"可编辑资料层"：基本信息 + 简历正文（JSON）上链，
///         同时记录 keccak256 内容哈希与全部历史版本。
///
/// 设计取舍（答辩要点）：
///   - TalentScout 里的社交信号（票 / 打赏 / 留言）只追加、永不可变；
///   - 简历资料放在本合约、允许本人更新，但每次更新都留哈希 → 改了什么、谁改的，链上可查。
///   - 生产环境可把 JSON 换成 IPFS/对象存储 URI，链上只留哈希与 URI；本合约同时保留 inline JSON
///     是为了黑客松现场可读、可当场校验。
contract ProfileRegistry {
    struct Profile {
        bytes32 contentHash; // keccak256(bytes(json))
        string json;         // 结构化简历 JSON
        uint64 updatedAt;
        uint32 version;
    }

    ITalentScout public immutable scout;
    uint256 public constant MAX_JSON = 2000;

    mapping(uint256 => Profile) private _profiles;
    mapping(uint256 => bytes32[]) private _history; // 各版本哈希，index 0 = v1

    event ProfileSet(uint256 indexed cardId, address indexed author, bytes32 contentHash, uint32 version);
    event ProfileUpdated(uint256 indexed cardId, address indexed author, bytes32 prevHash, bytes32 contentHash, uint32 version);

    constructor(address scoutAddress) {
        require(scoutAddress != address(0), "bad scout");
        scout = ITalentScout(scoutAddress);
    }

    /// @notice 写入 / 更新简历资料。权限 = TalentScout 里这张卡的所有人（跨合约校验）
    function setProfile(uint256 cardId, string calldata json) external returns (bytes32 contentHash, uint32 version) {
        require(bytes(json).length > 0 && bytes(json).length <= MAX_JSON, "bad json");

        address owner = scout.getCandidate(cardId).owner;
        require(owner != address(0), "no card");
        require(msg.sender == owner, "not card owner");

        bytes32 h = keccak256(bytes(json));
        Profile storage p = _profiles[cardId];
        bytes32 prev = p.contentHash;

        p.contentHash = h;
        p.json = json;
        p.updatedAt = uint64(block.timestamp);
        p.version = p.version + 1;
        _history[cardId].push(h);

        if (prev == bytes32(0)) emit ProfileSet(cardId, msg.sender, h, p.version);
        else emit ProfileUpdated(cardId, msg.sender, prev, h, p.version);

        return (h, p.version);
    }

    function getProfile(uint256 cardId) external view returns (Profile memory) {
        return _profiles[cardId];
    }

    /// @notice 全部历史版本的哈希（v1 → 最新）
    function getHashHistory(uint256 cardId) external view returns (bytes32[] memory) {
        return _history[cardId];
    }

    /// @notice 链上校验：传入一份 JSON，返回它是否与当前链上记录逐字节一致
    function verify(uint256 cardId, string calldata json) external view returns (bool) {
        bytes32 h = _profiles[cardId].contentHash;
        return h != bytes32(0) && h == keccak256(bytes(json));
    }

    function hasProfile(uint256 cardId) external view returns (bool) {
        return _profiles[cardId].contentHash != bytes32(0);
    }
}