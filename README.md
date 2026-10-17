# TalentScout · 链上星探

> 一个链上"候选人竞争市场"。
> 求职者发布一张**自荐卡**，社区免费投票 / 打赏 / 付费留言，票数达阈值自动进入**推荐池**，企业链上标记意向。

![TalentScout 首屏：被埋没的人，值得一次不看出身的机会](docs/first.png)

## 项目定位（为什么做这个）

**被埋没的人，值得一次不看出身的机会。**

最了解一个工程师水平的，不是 HR，也不是算法——**是和他一起写过代码的人**。但今天没有一个地方能把这句话公开记下来：简历是自我声明，招聘方只能用出身和大厂标签当代理指标；**同行背书只发生在私聊里，说完就没了**；平台里的"人气"你看不见谁点的、验不了真假、也带不走。

所以我们把"认可"做成一个**公开市场**——两层漏斗，缺一不可：

| 层 | 机制 | 它负责什么 | 它**不**负责什么 |
| --- | --- | --- | --- |
| **先被看见** | **免费投票**（1 地址 1 票、不可自投） | 让被埋没的人先有热度——**而热度买不到** | 不证明能力，只提供曝光 |
| **再被认可** | **打赏 MON / 0.01 MON 付费留言**（**带署名 + 交易哈希**） | 同行的实名背书——有成本、可追责、可验证 | 不是大众投票，不靠人缘 |
| 企业看 | **阈值入池** + **链上可校验简历** | 既有热度、又有背书、简历还没被改过 | — |

> **为什么不是单纯"大众认可"**：大众票不等于专业能力，很容易变成比人缘。真正能替代"内推"的是**同行愿意公开站台**——"我跟他一起写过合约，他做事靠谱"这一句，比一百个赞有价值。免费票负责让人被看见，付费留言负责让人被认可。

**受众**：求职者（核心：web3 新人 / 独立开发者 / 转行者）· 社区与活动主办方（增长：把一场活动沉淀成链上人才库）· 企业星探（付费方：看到已被陌生人验证过的人）· 围观者（0.01 MON 就能给朋友公开站台）。

**为什么是 Monad**：0.01 MON 级微支付才让"支持一个人"这件事的经济账成立；实测出块约 **0.33 秒**（前端角标实时显示），台上投票大屏几秒内就变；活动打榜天然是**高并发小交易**场景。

**边界（不做什么）**：不做履历真伪验证、不做完整招聘 ATS、不发平台代币（避免刷量污染信号）、不承诺"直推大厂"（落地的是推荐池 + 意向存证）。

> 完整的痛点分析、四类受众的用户旅程、商业逻辑与往期 200 项目避撞结论：**[docs/项目背景与受众.md](docs/项目背景与受众.md)**

## 玩法闭环

1. 求职者发布自荐卡（名字 + 一句话简介 + 技能标签 + 主题色）→ 真实上链
2. 求职者填**链上简历**（期望岗位 / 城市 / 经验 / 教育 / 经历）→ 内容哈希上链，可更新、可校验
3. 观众 👍 **免费投票**（1 地址 1 票、不可自投）——保证"人气"不能被钱买
4. 观众 💰 打赏任意金额 / 💬 0.01 MON 付费留言（定额费防垃圾）——"支持"可以有成本
5. 票数 ≥ 阈值（当前 5）→ 自动点亮 ⭐ **已入池**；终场 `snapshotTopK` 封榜
6. 🏢 企业/评委标记意向，公开可查
7. 候选人可随时 `withdraw` 提取全部支持金（打赏 + 留言费 100% 归候选人）

## 为什么放在 Monad

- **微支付可行**：留言费 0.01 MON 级别，实测约 100 gwei 基础费，单笔交互成本 ~0.02 MON 封顶
- **现场演示快**：出块快 + 前端 4 秒轮询，台上手机投票，大屏几秒内更新
- **高吞吐**：适合"活动期间高频互动"的拉票/打榜场景

## 链上信息（Monad Testnet）

| 项 | 值 |
| --- | --- |
| TalentScout 合约（自荐卡 / 投票 / 打赏 / 留言 / 意向） | `0xAB01cfA7Da5e44df314bA167C9f262f17CF6dda7` |
| TalentScout 浏览器 | https://testnet.monadscan.com/address/0xAB01cfA7Da5e44df314bA167C9f262f17CF6dda7 |
| TalentScout 部署交易 | https://testnet.monadscan.com/tx/0x3adf5a2ea57a14233e01d46a4e7f6c6bbc77f92bfe3c0d87874c67c4cfc38729 |
| **ProfileRegistry 合约（链上简历存证）** | `0x1d057b116e208dfb83D8D9c9D3E360442311AaDE` |
| ProfileRegistry 浏览器 | https://testnet.monadscan.com/address/0x1d057b116e208dfb83D8D9c9D3E360442311AaDE |
| ProfileRegistry 部署交易 | https://testnet.monadscan.com/tx/0xab8370edd673b3f89aa7b6ded96d7028d30c5a72a8dfc3efe91285b25cacc692 |
| chainId | 10143 |
| RPC | https://testnet-rpc.monad.xyz |
| 水龙头 | https://faucet.monad.xyz |

## 真实交易样例（验收用）

- 发布自荐卡 #1「阿茶」：https://testnet.monadscan.com/tx/0x89c86cce84bb24696e6e3618da05c54c091797631abaa347ea34b8ca5864b2b0
- 投票 #1 → 累计 5 票：https://testnet.monadscan.com/tx/0xa403e9853d86dc67df12f343c3eac21be9f76b1549b53a52906d787af392cc7c
- 达到阈值自动入池（Recommended 事件）：https://testnet.monadscan.com/tx/0xa403e9853d86dc67df12f343c3eac21be9f76b1549b53a52906d787af392cc7c
- 打赏 0.05 MON：https://testnet.monadscan.com/tx/0xa0d32c355cc395bd09148c30a29b0fd05d8e2fbf55d4c1bd9c11625192101bef
- 付费留言 0.01 MON：https://testnet.monadscan.com/tx/0x6a67f2e31f5b72b9f58f107dadccc2b38dfeaf0308f6b72f9b67531a79bcd987
- 企业标记意向 #2：https://testnet.monadscan.com/tx/0x0b4c26005449732496b79bd105d918e7ae525961b31405c91e4809e69f5d3f9d

**链上简历（ProfileRegistry，8 份全部真实上链）**

- #1 阿茶：https://testnet.monadscan.com/tx/0xfcd469b604a261a4e321365fe126d286baea99e48a5e4cfb92718532e04a7346
- #2 Luna：https://testnet.monadscan.com/tx/0x61b796c2a15dfedd63c3854343bafaca7d3e02fa5f84ce7f3c2b220f376e9718
- #3 老周：https://testnet.monadscan.com/tx/0x1b1e4a98b6724ff46ae155df3df6d9994a23facd004b60c4d034b75637f7736c
- #4 小鹿：https://testnet.monadscan.com/tx/0x1f5db1dee05304f768a209d535ca6337518ae55cd2bb45f54e7c500e80ae6c75
- #5 Ken：https://testnet.monadscan.com/tx/0x606ec909919e7acd8fd684dbc2e214901b6c946835f90bf4287d889b10bb7a07
- #6 泡泡：https://testnet.monadscan.com/tx/0xe02779d9bbbd3e41989bb9e189f9332eb38682ac2fee3b487d27ddabc7ec54eb
- #7 阿杰：https://testnet.monadscan.com/tx/0x0e2154d3b8582d4a7c25feabd3f12919aee6bb6178c2168fb852d305fa60df3c
- #8 Mia：https://testnet.monadscan.com/tx/0xb72ce8cb29ced325d8e862960219913d47f98a5a77fb82af1d623f9366a13f16

> 汇总脚本：`node scripts/events.mjs`（自动分页扫链，输出全量事件链接）

## 卡片信息能不能改？

| 内容 | 能否修改 | 怎么改 |
| --- | --- | --- |
| **简历**：期望岗位 / 城市 / 经验 / 教育 / 经历 / 简介 / 技能 / **联系方式** | ✅ **能，本人随时改** | 两条路：**① 发布时一起填** —— 发布表单里展开「📄 链上简历」，填完点发布，前端会自动发第二笔把简历写上链（`Published` 事件里解析出新卡片编号）；**② 事后补** —— 点开自己的卡片 → 📄 链上简历 → **✏️ 编辑简历** → 改内容 → **💾 保存上链**。两条路**用的是同一套表单界面**（字段由 `RESUME_FIELDS` 一处定义生成，发布用前缀 `r`、编辑用前缀 `e`）——**编辑不会让你手写 JSON**。两条路都留版本号，历史哈希全部可查（`getHashHistory`）。<br>JSON 文本框只留给「🔐 链上校验」——那一步本质就是"比对一份 JSON"，表单反而说不清楚 |
| **卡片主体**：名字 / 一句话简介 / 技能标签 / 链接 / 主题色 | ❌ 当前版本不能 | TalentScout 里没有 update 函数，发布即固定；要改只能发新卡（票数与打赏不会迁移） |

**为什么这样设计**：卡片是你在活动里的**身份锚点**——如果名字和一句话能改，早期投出的票就失去了上下文，榜单历史也没法解释。而简历是**作品集**，本来就该随经历更新。于是变成"**身份不可改、资料可更新、更新留痕**"。

> Roadmap 第一条：加 `updateCard(id, ...)`，用同样的 owner 校验 + 修改历史，让打错字也能改。

## 界面截图（docs/）

| 截图 | 内容 |
| --- | --- |
| `screenshot-main.png` | 人才墙 + 人气榜（含区块心跳角标、卡片上的"📄 链上简历"标记） |
| `screenshot-modal.png` | 卡片详情：投票 / 打赏 / 付费留言 / 企业意向 |
| `screenshot-pool.png` | **企业视图**：推荐池 + 技能筛选 + 一键标注意向 |
| `screenshot-offline.png` | **离线兜底**：RPC 不可达时自动降级到链上快照并明确标注 |
| `screenshot-dark.png` / `screenshot-light.png` | **夜间 / 白天双主题**（右上角一键切换，选择记在本地） |
| `screenshot-messages.png` | **留言墙**：每条留言标出链上来源地址、头像色块与交易链接 |
| `screenshot-publish-resume.png` | **发布表单里的简历录入**：填完发布即自动上链（两笔交易） |
| `screenshot-podium.png` | **领奖台层次**：名次牌 1/2/3 + 高低差 + 金银铜边框（冠军居中） |
| `screenshot-intent.png` | **企业意向可查**：哪几个地址标记过（带交易链接）+ 入池时刻 |
| `screenshot-contact.png` | **接触路径**：简历里的 `📮 联系我`（带「公开」标签）+ 留言墙的「候选人回复」 |
| `screenshot-edit-resume.png` | **编辑简历 = 和首次填写同一套表单**（预填链上当前内容，不是手写 JSON） |
| `screenshot-resume.png` | **链上简历**：基本信息 + 经历 + 版本与内容哈希 |
| `screenshot-verify-ok.png` | **篡改校验通过**：与链上记录逐字节一致 |
| `screenshot-verify-bad.png` | **篡改校验失败**：改一个字就对不上 |
| `screenshot-celebrate.png` | 票数达阈值，卡片金光闪卡 + 弹条入池 |
| `qr-*.png`（**不进仓库**） | 现场扫码入口：站点首页 / 直达某位候选人的卡片。二维码里是当天笔记本的局域网 IP，换网络就失效——演示前用 `node scripts/makeqr.mjs "http://<当前IP>:8080/frontend/?id=4" docs/qr-card4.png` 现生成即可 |

## 链上简历是怎么设计的

| 数据 | 放在哪 | 能不能改 |
| --- | --- | --- |
| 票数 / 打赏 / 留言 / 企业意向 | TalentScout | ❌ 只追加，永不可变 |
| 基本信息 / 简历正文 / 期望岗位 | ProfileRegistry | ✅ 本人可改，**每次更新留哈希** |

- **权限**：ProfileRegistry 通过 `ITalentScout(scout).getCandidate(id).owner` **跨合约**校验"你是不是这张卡的主人"——非本人写入直接 revert（`not card owner`）。
- **存证**：每次写入记录 `keccak256(json)` 与版本号，历史哈希全部留痕（`getHashHistory`）。
- **校验**：`verify(cardId, json)` 返回传入内容是否与链上记录逐字节一致。前端详情页有「🔐 链上校验」按钮——改一个字符就会变红，**这是招聘场景真正需要的能力：证明简历没被中间环节改过**。
- **生产形态**：长文本不该整段上链，生产环境把 JSON 换成 IPFS / 对象存储 URI，链上只留哈希 + URI；本仓库内联 JSON 是为了黑客松现场可读、可当场校验（合约上限 2000 字节）。

### 企业意向与入池时刻同样可查

合约里只存了计数（`interestCount`），但 **`InterestMarked` 事件带了标记方地址**——和留言墙同一个问题、同一个解法：`snapshot.mjs` 扫链恢复出"是哪几家"，前端列出地址 + 交易链接；`Recommended` 事件则恢复出**入池时刻**（第几块、当时几票）。

| 数据 | 合约里有什么 | 事件里有什么 | 前端展示 |
| --- | --- | --- | --- |
| 留言 | 只有文本 | 作者地址 + 文本 | 头像 + 可点地址 + 交易链接 |
| 企业意向 | 只有计数 | **标记方地址** | 地址列表 + 每家的交易链接 |
| 入池 | 只有 `bool` | 入池时的票数 | 入池区块高度 + 交易链接 |

> 三者都做**完整性自检**：事件条数 ≠ 链上计数时宁可不显示归属，也不标错人。

### 企业标记意向后，怎么联系到候选人？

**产品判断：链上不该承载沟通本身，链上该承载"沟通该不该发生"。** 招聘的沟通必须私密（邮箱、面试安排），硬把聊天搬上链既贵又荒谬。**意向上链，接触下链**——链上留下的是可验证的意向凭证，接触走两条铺好的路：

| 路径 | 谁主动 | 实现 |
| --- | --- | --- |
| **候选人公开联系偏好** | 候选人 | 简历的 `contact` 字段（Telegram / X / 邮箱），卡片上带 **`公开`** 标签 + 复制按钮；**填不填由候选人决定** |
| **候选人公开回应** | 候选人 | 候选人在自己留言墙发言 → 前端识别发帖人 = 卡片主人 → 打上 **「候选人回复」** 标签 |

隐私取舍写进 UI：字段完全可选，明确标注「**公开**」，并建议只填**能屏蔽的渠道**（Telegram / X），不填手机号。

> ⚠️ 链上的一切都是永久、可被爬的——所以这里的选择权必须留给候选人，而不是替他决定。

## 快速开始

```bash
npm install
npm run compile         # 本地编译合约（solc-js）
npm run deploy          # 部署 TalentScout 到 Monad 测试网（写入 deployments.json）
npm run deploy-profile  # 部署 ProfileRegistry（链上简历登记处）并绑定上面的合约
npm run seed            # 播种 8 张样例自荐卡
npm run seed-profiles   # 给每张卡补上链上简历（8 笔真实交易）
npm run sponsor -- 0x观众地址... --amount 0.05   # （可选）主办方发 gas 补贴，让现场观众零成本投票
npm run snapshot        # 导出链上状态快照（断网时前端自动降级使用，演示兜底）
npm run serve           # 启动静态前端 → http://localhost:8080/frontend/
```

辅助脚本（scripts/）：

- `state.mjs` 链上状态一览（票数/支持金/留言/意向/入池）
- `events.mjs` 全量事件链接清单（防 RPC 100 块限制，自动分页）
- `smoketest.mjs` / `finish-smoke.mjs` 冒烟测试（投票/打赏/留言/意向）
- `boost.mjs` 预置票数（把目标卡补到阈值附近，留 1 票给现场演示）
- `vote-test.mjs <id>` 用 W1-W4 给指定卡投票（彩排/现场备用）
- `makeqr.mjs <url> <out.png>` 生成站点二维码（观众扫码用）
- `wallet-check.mjs 0x...` 查询任意钱包的余额与投票/意向状态（演示前"干净度"检查）
- `deploy-profile.mjs` 部署 ProfileRegistry 并绑定已部署的 TalentScout（不动已有卡片数据）
- `seed-profiles.mjs` 给每张卡写入链上简历 + 校验自检 + 非 owner 写入被拒的权限自检
- `write-config.mjs` 部署脚本共用的配置生成（artifacts → contract.config.js / deployments.json）
- `sponsor.mjs 0xabc... --amount 0.05` **活动主办方一键给参与者补 gas**（产品能力，不在 3 分钟路演里演；`--file addrs.txt` 批量、`--dry` 只算账、`--keep` 设余额下限）
- `snapshot.mjs` 导出链上全量状态到 `frontend/fallback.json`（断网时前端自动降级渲染，网络恢复自动切回）

## 合约接口（单文件 TalentScout.sol）

| 函数 | 说明 |
| --- | --- |
| `publish(name, tagline, skills, links, theme)` | 发布自荐卡 |
| `vote(id)` | 免费投票（1 地址 1 票；达阈值自动 recommended） |
| `tip(id) payable` | 打赏任意金额 |
| `postMessage(id, text) payable` | 付费留言（0.01 MON，≤120 字符） |
| `markInterest(id)` | 企业/评委标记意向 |
| `withdraw(id)` | 候选人提取支持金 |
| `snapshotTopK(k)` | 主办方终场封榜（Top K 入池） |
| `setVoteThreshold(t)` | 主办方调阈值 |
| `getCandidate / getTop / getMessages / getStats / pending / hasVoted / hasMarked` | 只读接口 |

事件：`Published / Voted / Tipped / MessagePosted / Recommended / InterestMarked / Withdrawn`

### ProfileRegistry（链上简历登记处，独立合约）

| 函数 | 说明 |
| --- | --- |
| `setProfile(cardId, json)` | 写入 / 更新简历（≤2000 字节）；权限 = TalentScout 里该卡 owner（跨合约校验） |
| `getProfile(cardId)` | 取当前简历：内容哈希 / JSON / 更新时间 / 版本号 |
| `getHashHistory(cardId)` | 全部历史版本哈希（v1 → 最新） |
| `verify(cardId, json)` | 传入一份 JSON，返回是否与链上记录逐字节一致 |
| `hasProfile(cardId)` | 这张卡有没有链上简历 |

事件：`ProfileSet / ProfileUpdated`

## 目录结构

```
talentscout/
├── contracts/
│   ├── TalentScout.sol         # 社交信号：自荐卡 / 投票 / 打赏 / 留言 / 意向（不可变，只追加）
│   └── ProfileRegistry.sol     # 链上简历：基本信息 + 简历 JSON + 内容哈希 + 版本历史
├── scripts/                    # 编译 / 部署 / 简历播种 / 冒烟 / 状态 / 事件 / 补票 / 静态服务
├── frontend/                   # 零构建前端（index.html + app.js + contract.config.js）
├── artifacts/                  # 编译产物
├── docs/
│   ├── 项目背景与受众.md        # 痛点 / 受众 / 商业逻辑 / 边界（路演素材）
│   ├── 答辩Q&A.md              # 路演口径（本地手册，不随仓库发布）
│   ├── 录屏脚本.md             # 2 分钟视频分镜（本地手册，不随仓库发布）
│   └── screenshot-*.png        # 界面截图（二维码是本地生成的，不进仓库）
├── deployments.json            # 部署信息（含 ProfileRegistry）
└── DEMO.md                     # 现场演示手册（含钱包准备与自测清单）—— **本地文件，不随仓库发布**
```

## 交付清单

- [x] 合约部署 Monad Testnet（chainId 10143）—— TalentScout + ProfileRegistry 两个
- [x] 真实交易样例 ≥5 条（发布 / 投票 / 打赏 / 留言 / 意向 / 简历，共 20+ 笔，均可点开浏览器验收）
- [x] 完整闭环演示 + 现场手册（严格 180 秒脚本 + 自测清单，手册为本地文件不随仓库发布）
- [x] README + 项目背景与受众（本仓库）· 答辩 Q&A 与现场/录屏手册（本地，不随仓库发布）
- [x] 抗风险：离线快照兜底、gas 补贴脚本、20 个可复现脚本
- [x] 3 分钟现场脚本 + 2 分钟录屏脚本（均为本地手册，不随仓库发布；观众互动镜头放在视频里）
- [ ] 2 分钟演示视频（照着脚本拍，待录）
- [ ] 一页 pitch / 公网演示链接（`frontend/` 已自包含，可直接丢任意静态托管）

## Known Limitations（答辩时如实说明）

- **女巫攻击**：测试网不做防女巫（1 地址 1 票）；生产应绑定活动凭证 / POAP / 质押门槛
- **"直推大厂"是营销口径**：本项目落地的是"推荐池 + 意向存证"，真实招聘闭环需要企业侧对接
- **公共 RPC 限制**：不支持 `eth_newFilter`（事件订阅），前端已改为 4 秒轮询 + 立即刷新；`eth_getLogs` 限 100 区块（脚本已分页）
- **低余额账户节流**：<10 MON 的账户每 ~1.2 秒只能发 1 笔交易（演示脚本已自动间隔）
- **留言不可删除**：链上特性；用定额费 + 长度限制缓解垃圾信息
- **链上简历是明文**：本仓库把简历 JSON 内联上链（≤2000 字节），**任何人都能读到**——这是演示取舍；生产环境应只把哈希与 IPFS URI 上链，正文放链下存储。同时链上存的是"本人自述 + 哈希留痕"，不是机构认证，**不做真伪背书**。
- **更新简历比首次填写便宜约 4 倍**：实测 712 字节的简历，首次写入约 46 万 gas（0 → 非零，每槽 20,000），之后更新同一张卡只要约 11.5 万 gas（非零 → 非零，每槽 5,000，EIP-2200 净计量）。**别用 `estimateGas` 给这笔交易定价**——它按当前状态估算，重新写入相同内容时会低到 13.5 万（SSTORE 无变化不涨价），拿它当 gasLimit 会低估首次写入。本项目按内容字节数动态算 gasLimit（`gasForResume`），因为 Monad 按 **gasLimit** 而不是 gasUsed 计费。
- **测试网数据随时可能重置**

## Roadmap

SBT 徽章（达阈值 mint）→ 全链上 SVG 卡片 / NFT 化自荐卡 → 企业认证名单 → 投票权凭证化（POAP/活动 NFT）→ 简历 JSON 改存 IPFS、链上只留哈希 + URI → 企业侧推荐池看板（含技能筛选与意向管理）→ 主网部署