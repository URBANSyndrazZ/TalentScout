// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TalentScout —— 链上星探（Monad Blitz 黑客松项目）
/// @notice 求职者发布"自荐卡"；观众免费投票（1 地址 1 票）；可打赏、可付费留言；
///         企业/评委可标记意向；达到票数阈值自动进入"推荐池"。
contract TalentScout {
    struct Candidate {
        address owner;
        string name;
        string tagline;
        string skills;
        string links;
        uint8 theme;
        uint32 votes;
        uint256 tips;          // 累计支持金（含留言费），统计口径
        uint32 msgCount;
        uint32 interestCount;
        bool recommended;
    }

    address public organizer;
    uint256 public voteThreshold = 10;
    uint256 public constant MESSAGE_FEE = 0.01 ether;

    uint256 public constant MAX_NAME = 40;
    uint256 public constant MAX_TAGLINE = 80;
    uint256 public constant MAX_SKILLS = 80;
    uint256 public constant MAX_LINKS = 120;
    uint256 public constant MAX_MESSAGE = 120;

    uint256 public candidateCount;
    mapping(uint256 => Candidate) private _candidates;
    mapping(uint256 => string[]) private _messages;
    mapping(uint256 => uint256) public pending;                     // 可提取的支持金
    mapping(uint256 => mapping(address => bool)) public hasVoted;   // 防重复投票
    mapping(uint256 => mapping(address => bool)) public hasMarked;  // 防重复标记意向

    event Published(uint256 indexed id, address indexed owner, string name, string tagline);
    event Voted(uint256 indexed id, address indexed voter, uint32 votes);
    event Tipped(uint256 indexed id, address indexed from, uint256 amount, uint256 totalTips);
    event MessagePosted(uint256 indexed id, address indexed from, string text, uint256 totalTips);
    event Recommended(uint256 indexed id, uint32 votes);
    event InterestMarked(uint256 indexed id, address indexed company, uint32 total);
    event Withdrawn(uint256 indexed id, address indexed owner, uint256 amount);

    constructor() {
        organizer = msg.sender;
    }

    /// @notice 主办方调节"入池"阈值
    function setVoteThreshold(uint256 t) external {
        require(msg.sender == organizer, "only organizer");
        voteThreshold = t;
    }

    /// @notice 发布一张自荐卡
    function publish(
        string calldata name,
        string calldata tagline,
        string calldata skills,
        string calldata links,
        uint8 theme
    ) external returns (uint256 id) {
        require(bytes(name).length > 0 && bytes(name).length <= MAX_NAME, "bad name");
        require(bytes(tagline).length <= MAX_TAGLINE, "tagline too long");
        require(bytes(skills).length <= MAX_SKILLS, "skills too long");
        require(bytes(links).length <= MAX_LINKS, "links too long");
        require(theme < 8, "bad theme");

        id = ++candidateCount;
        Candidate storage c = _candidates[id];
        c.owner = msg.sender;
        c.name = name;
        c.tagline = tagline;
        c.skills = skills;
        c.links = links;
        c.theme = theme;

        emit Published(id, msg.sender, name, tagline);
    }

    /// @notice 免费投票：1 个地址对同一张卡只能投 1 票；不能给自己投票
    function vote(uint256 id) external {
        Candidate storage c = _candidates[id];
        require(c.owner != address(0), "no candidate");
        require(msg.sender != c.owner, "cannot vote self");
        require(!hasVoted[id][msg.sender], "already voted");

        hasVoted[id][msg.sender] = true;
        c.votes += 1;

        if (!c.recommended && c.votes >= voteThreshold) {
            c.recommended = true;
            emit Recommended(id, c.votes);
        }
        emit Voted(id, msg.sender, c.votes);
    }

    /// @notice 打赏：任意金额，进入待提取余额
    function tip(uint256 id) external payable {
        Candidate storage c = _candidates[id];
        require(c.owner != address(0), "no candidate");
        require(msg.value > 0, "no value");

        c.tips += msg.value;
        pending[id] += msg.value;
        emit Tipped(id, msg.sender, msg.value, c.tips);
    }

    /// @notice 付费留言：固定 0.01 MON，<=120 字符
    function postMessage(uint256 id, string calldata text) external payable {
        Candidate storage c = _candidates[id];
        require(c.owner != address(0), "no candidate");
        require(msg.value >= MESSAGE_FEE, "fee required");
        require(bytes(text).length > 0 && bytes(text).length <= MAX_MESSAGE, "bad text");

        _messages[id].push(text);
        c.msgCount += 1;
        c.tips += msg.value;
        pending[id] += msg.value;
        emit MessagePosted(id, msg.sender, text, c.tips);
    }

    /// @notice 企业/评委标记兴趣（同样上链、公开可查）
    function markInterest(uint256 id) external {
        Candidate storage c = _candidates[id];
        require(c.owner != address(0), "no candidate");
        require(msg.sender != c.owner, "cannot mark self");
        require(!hasMarked[id][msg.sender], "already marked");

        hasMarked[id][msg.sender] = true;
        c.interestCount += 1;
        emit InterestMarked(id, msg.sender, c.interestCount);
    }

    /// @notice 候选人提取支持金
    function withdraw(uint256 id) external {
        Candidate storage c = _candidates[id];
        require(msg.sender == c.owner, "not owner");
        uint256 amt = pending[id];
        require(amt > 0, "nothing to withdraw");
        pending[id] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amt}("");
        require(ok, "transfer failed");
        emit Withdrawn(id, msg.sender, amt);
    }

    /// @notice 终场封榜：把票数 Top K 也标记进推荐池（主办方调用）
    function snapshotTopK(uint256 k) external returns (uint256[] memory topIds) {
        require(msg.sender == organizer, "only organizer");
        (topIds, ) = _top(k);
        for (uint256 i = 0; i < topIds.length; i++) {
            uint256 id = topIds[i];
            if (id == 0) continue;
            Candidate storage c = _candidates[id];
            if (!c.recommended) {
                c.recommended = true;
                emit Recommended(id, c.votes);
            }
        }
    }

    /// @notice 人气榜 Top N
    function getTop(uint256 n) external view returns (uint256[] memory ids, uint32[] memory votes) {
        (ids, votes) = _top(n);
    }

    function _top(uint256 n) internal view returns (uint256[] memory ids, uint32[] memory votes) {
        if (n > candidateCount) n = candidateCount;
        ids = new uint256[](n);
        votes = new uint32[](n);
        for (uint256 id = 1; id <= candidateCount; id++) {
            uint32 v = _candidates[id].votes;
            if (v == 0) continue;
            for (uint256 k = 0; k < n; k++) {
                if (v > votes[k]) {
                    for (uint256 j = n - 1; j > k; j--) {
                        votes[j] = votes[j - 1];
                        ids[j] = ids[j - 1];
                    }
                    votes[k] = v;
                    ids[k] = id;
                    break;
                }
            }
        }
    }

    // ────────── 只读接口 ──────────
    function getCandidate(uint256 id) external view returns (Candidate memory) {
        return _candidates[id];
    }

    function getMessages(uint256 id) external view returns (string[] memory) {
        return _messages[id];
    }

    function getStats() external view returns (uint256 totalCandidates, uint256 threshold) {
        return (candidateCount, voteThreshold);
    }
}