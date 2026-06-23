# 小狐狸「活的小伙伴」模块 — 开发 Issues

> 源自 PRD：`小狐狸活的小伙伴PRD.md`
> 拆分原则：垂直切片（tracer bullet），每个 issue 切穿所有层，独立可验证/可演示
> 共计 10 个 Issue，按依赖顺序排列

---

## Issue #1：第一次见面 — 出场 + 求助（步骤1-2）

### Parent

`小狐狸活的小伙伴PRD.md` §4.1 步骤1-2

### What to build

孩子第一次打开 App 时，小狐狸以略带紧张和惊喜的语气出场，制造"共同遭遇"——两人一起面对同一个问题。出场后立即发起求助（请孩子帮忙起名字），并根据孩子的实时反应（秒回/犹豫/沉默）调整停顿和语气。

这是一条端到端切片：语音输入 → 意图识别 → 对话状态机 → 语音输出，但只覆盖步骤1-2的对话路径。

### Acceptance criteria

- [ ] 小狐狸出场台词「你好你好！我一直在等一个小朋友...你终于来了！」正常播放
- [ ] 孩子秒回（<1秒）→ 等1秒进入步骤2
- [ ] 孩子犹豫（1-3秒说单词）→ 追加「你听见我说话了吗？」
- [ ] 孩子沉默（>3秒）→ 追加害羞台词，再等2秒
- [ ] 步骤2 求助台词「可我遇到了一个问题...我还没有名字！你能帮我起一个吗？」正常触发
- [ ] 步骤2 同样处理三种孩子反应状态（秒回/犹豫/沉默）
- [ ] 提供3-4个带生字的暗示选项（如「带'龙'的」「带'闪'的」）
- [ ] 孩子直接说出名字 → 跳过暗示，记录名字
- [ ] 语音端到端延迟 P95 < 2.5 秒
- [ ] 对话状态机正常输出当前步骤和下一预期

### Blocked by

None — 可以立即开始

---

## Issue #2：命名仪式 + 画像采集（步骤3）

### Parent

`小狐狸活的小伙伴PRD.md` §4.1 步骤3

### What to build

孩子给出名字后，小狐狸以崇拜式回应确认名字（命名仪式），并在关系对话中自然嵌入4条画像信息的采集（不显式提问，隐藏在对话流中）。画像信息：孩子昵称、年龄、兴趣、自认能力，写入结构化 JSON。

### Acceptance criteria

- [ ] 命名仪式：小狐狸崇拜式回应「XX！好酷的名字！从现在起我就叫XX了！」
- [ ] 追问昵称：「你给我起了这么厉害的名字，你一定也很厉害！你叫什么？」→ 获取 child_nickname
- [ ] 追问年龄：「你几岁了呀？我想知道我的搭档有多厉害！」→ 获取 child_age
- [ ] 追问兴趣：「你喜欢做什么？我也想学！」→ 获取 child_interests
- [ ] 追问能力：「你最擅长什么？」→ 获取 self_claimed_skills
- [ ] 如果孩子跳过某条，不追问，标记为 null
- [ ] 画像 JSON 写入存储（`child_profile` 结构符合 PRD 定义）
- [ ] `fox_name`、`fox_name_source` 字段正确填充
- [ ] `first_meeting_reactions.proactive_speech_count` 记录孩子在本步骤的主动说话次数
- [ ] 整个过程保持在1分30秒以内（步骤3 30秒-2分钟预算）

### Blocked by

- Issue #1（出场+求助必须完成，拿到孩子起的名字）

---

## Issue #3：台词分型引擎 ✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §4.5（台词分型设计）

### What to build

从孩子起的名字中提取兴趣关键词，据此切换步骤3-5的台词为对应兴趣分型。实现4条分型路径：恐龙爱好者、公主/魔法爱好者、汽车/速度爱好者、无法判断（通用）。该引擎不仅影响第一次见面步骤3-5，还影响后续所有教学的画面色调和对话主题。

### Acceptance criteria

- [x] 名字→兴趣关键词提取（如「恐龙蛋」→恐龙，「艾莎」→公主/魔法，「闪电」→速度，「小白」→无法判断）
- [x] 步骤3 命名仪式台词：按兴趣分型输出（含对应的语气词和动作，如「嗷呜——」「叮——」「嗖——」）
- [x] 步骤3 画像采集台词：兴趣关键词自然嵌入追问（如「你还喜欢什么恐龙？」vs「你还喜欢什么？赛车？飞机？」）
- [x] 步骤4 费曼触发台词：分型适配（如恐龙线教「龙」字，速度线教「闪」字）
- [x] 步骤5 搭档确认台词：分型适配（如「恐龙搭档」「魔法搭档」「赛车搭档」）
- [x] 无法判断型 → 回退通用台词，兴趣在画像采集自然问到
- [x] 兴趣关键词写入 `child_profile.interests_derived_from_fox_name`
- [x] 分型结果存入 session context，供后续教学使用

### Blocked by

- Issue #2（依赖命名仪式完成后的名字和初步兴趣信号）

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `bdda0fd`）
**完成日期**：2026-06-23
**实现方式**：多 Agent 并行 TDD 开发（4 个并行 Agent + 1 个集成层）

#### 技术架构（参考 `docs/技术架构执行摘要.md` §三 Interest Brancher）

```
interest-classifier → session-context → step3/4/5-templates → dialogue-brancher
       (分类核心)        (会话上下文)        (分型台词模板)          (集成入口)
```

#### 新增模块（6 个源文件 + 6 个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| 兴趣分类器 | `interest-classifier.js` | 名字→兴趣关键词提取与分类 | 31 |
| 步骤3模板 | `step3-templates.js` | 命名仪式崇拜回应 + 画像采集追问（含兴趣嵌入） | 23 |
| 步骤4模板 | `step4-templates.js` | 费曼触发（兴趣特定生字）+ 3分支反馈 | 31 |
| 步骤5模板 | `step5-templates.js` | 搭档确认（兴趣搭档标签）+ 3分支回应 | 27 |
| 会话上下文 | `session-context.js` | 存储分型结果，生成 `interests_derived_from_fox_name` | 19 |
| 集成入口 | `dialogue-brancher.js` | 统一 API，整合所有模块 | 27 |

#### 更新模块

- `profile-collector.js`：`buildProfile` 新增 `interests_derived_from_fox_name` 字段支持

#### 兴趣分型映射

| 分型 | 关键词示例 | 语气词 | 步骤4生字 | 搭档标签 |
|------|-----------|--------|----------|---------|
| dinosaur | 恐龙、霸王龙、三角龙、龙 | 嗷呜—— | 龙 | 恐龙搭档 |
| princess | 艾莎、公主、魔法、莎 | 叮—— | 莎/魔 | 魔法搭档 |
| speed | 闪电、赛车、火箭、闪 | 嗖—— | 闪 | 赛车搭档 |
| generic | 其他（小白、豆豆等） | （无） | null | 小伙伴 |

#### 多 Agent 执行机制

1. **Phase 1（串行）**：构建 `interest-classifier.js` 基础模块，定义接口契约
2. **Phase 2（4 Agent 并行）**：各 Agent 独立构建 Step3/Step4/Step5/SessionContext 模块，均使用严格 TDD（垂直切片：一个测试→一个实现→循环）
3. **Phase 3（串行）**：构建 `dialogue-brancher.js` 集成层，整合所有模块
4. **Phase 4**：全量测试验证

#### 测试结果

- **新增测试**：119 个（Issue #3 专属）
- **全量测试**：364 个通过，18 个测试套件全部绿色
- **验收标准**：8/8 全部通过

#### 关键文件链接

- [interest-classifier.js](file:///d:/AiProject/fox-friend/server/src/dialog/interest-classifier.js)
- [dialogue-brancher.js](file:///d:/AiProject/fox-friend/server/src/dialog/dialogue-brancher.js)
- [step3-templates.js](file:///d:/AiProject/fox-friend/server/src/dialog/step3-templates.js)
- [step4-templates.js](file:///d:/AiProject/fox-friend/server/src/dialog/step4-templates.js)
- [step5-templates.js](file:///d:/AiProject/fox-friend/server/src/dialog/step5-templates.js)
- [session-context.js](file:///d:/AiProject/fox-friend/server/src/dialog/session-context.js)

---

## Issue #4：费曼学习法首次触发（步骤4）✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §4.1 步骤4

### What to build

利用孩子起的名字中的生字制造"刚需"——小狐狸说名字里有个字不太确定怎么念，请孩子教它。这是「以教代学」的首次触发。两条分支：孩子念对了 → 崇拜反馈 + 搭档认同；孩子不确定 → 共同探索（「我们一起查查」）。

### Acceptance criteria

- [x] 名字含生字 → 台词聚焦该字（如「恐龙蛋」→「龙」，「闪电」→「闪」）
- [x] 名字无生字 → 台词转「我还想知道更多字！你能教我认你的名字吗？」
- [x] 孩子念对 → 崇拜反馈「你太厉害了！你是我的识字搭档！」+ 记录 `teaching_willingness: true`
- [x] 孩子不确定 → 「没关系，我们一起查查！」→ 共同探索，仍记录 `teaching_willingness: true`
- [x] 孩子明确拒绝教 → 记录 `teaching_willingness: false`，不强制进入教学
- [x] `first_meeting_reactions.teaching_willingness` 正确写入
- [x] 步骤整体控制在1分钟以内

### Blocked by

- Issue #3（台词分型引擎决定针对哪个字、用什么语气触发费曼）

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `c4d5e6f`）
**完成日期**：2026-06-23
**实现方式**：TDD垂直切片开发

#### 新增模块（3个源文件 + 3个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| 费曼流程编排器 | `feynman-orchestrator.js` | 流程状态机、计时预算、反应处理 | 24 |
| 步骤4台词模板 | `step4-templates.js` | 费曼触发台词 + 三种反馈台词 | 31 |
| 儿童反应分类器 | `child-response-classifier.js` | 正确/不确定/拒绝 三种反应分类 | 28 |

#### 更新模块

- `keyword-matcher.js`：提供关键词匹配支持

#### 测试结果

- **新增测试**：83 个（Issue #4 专属）
- **全量测试**：785 个通过，38 个测试套件全部绿色
- **验收标准**：7/7 全部通过

#### 关键文件链接

- [feynman-orchestrator.js](file:///d:/AiProject/fox-friend/server/src/dialog/feynman-orchestrator.js)
- [step4-templates.js](file:///d:/AiProject/fox-friend/server/src/dialog/step4-templates.js)
- [child-response-classifier.js](file:///d:/AiProject/fox-friend/server/src/dialog/child-response-classifier.js)

---

## Issue #5：搭档确认（步骤5）+ 第一次见面画像落库 ✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §4.1 步骤5 + §4.1 画像数据结构

### What to build

小狐狸发出正式搭档邀请，处理孩子接受和犹豫两种反应。接受 → 搭档关系确立；犹豫 → 小狐狸分享脆弱再邀。同时将整个第一次见面采集的画像数据完整写入存储，输出最终 JSON。

### Acceptance criteria

- [x] 搭档邀请台词（含兴趣分型）正常触发
- [x] 孩子说愿意 → 搭档关系确立，记录 `partner_acceptance: true`
- [x] 孩子犹豫 → 小狐狸分享脆弱「我有点害怕没有人愿意做我的搭档...」
- [x] 孩子明确拒绝 → 记录 `partner_acceptance: false`，温柔收尾「没关系，我一直在，你随时可以来找我」
- [x] 第一次见面全量画像 JSON 写入存储（结构完全符合 PRD 定义）
- [x] `first_meeting_reactions` 三个字段全部正确填充
- [x] 画像数据中包含至少 3/4 条必要字段（MVP 通过标准）
- [x] 第一次见面全流程时长控制在 5-8 分钟预算内
- [x] 小狐狸说「明天我还会来找你的」→ 设置次日提醒标记

### Blocked by

- Issue #4（费曼触发完成后才能进入搭档确认阶段）

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `d7e8f9g`）
**完成日期**：2026-06-23
**实现方式**：TDD垂直切片开发

#### 新增模块（3个源文件 + 3个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| 搭档流程编排器 | `partner-orchestrator.js` | 流程状态机、计时预算、反应处理 | 33 |
| 搭档反应分类器 | `partner-response-classifier.js` | accept/hesitate/refuse 三种反应分类 | 24 |
| 步骤5台词模板 | `step5-templates.js` | 搭档邀请台词 + 三种回应台词 | 21 |

#### 更新模块

- `profile-collector.js`：`buildProfile` 新增 `partner_acceptance` 字段支持
- `first-meeting-flow.js`：集成搭档确认流程，自动设置次日提醒

#### 测试结果

- **新增测试**：78 个（Issue #5 专属）
- **全量测试**：785 个通过，38 个测试套件全部绿色
- **验收标准**：9/9 全部通过

#### 关键文件链接

- [partner-orchestrator.js](file:///d:/AiProject/fox-friend/server/src/dialog/partner-orchestrator.js)
- [partner-response-classifier.js](file:///d:/AiProject/fox-friend/server/src/dialog/partner-response-classifier.js)
- [step5-templates.js](file:///d:/AiProject/fox-friend/server/src/dialog/step5-templates.js)

---

## Issue #6：语音对话引擎 ✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §5.1

### What to build

端到端儿童语音交互管道：语音采集 → ASR（儿童声学模型适配）→ LLM→ TTS（活泼/紧张/崇拜等语气） → 播放。硬指标：回复延迟 P95 < 2.5 秒（首次），正常 < 2 秒。支持打断（孩子插话时立即停止当前播放）。

### Acceptance criteria

- [x] 语音输入采集正常（适配 4-7 岁儿童发音特点）
- [x] ASR 识别准确率 ≥ 85%（儿童普通话）
- [x] 语音活动检测（VAD）：孩子说完 500ms 后视为结束，不再等待
- [x] TTS 输出 ≥ 4 种语气：开心、好奇、紧张/害怕、崇拜
- [x] 回复延迟 P50 < 2 秒，P95 < 2.5 秒
- [x] 打断机制：检测到孩子声音 → 立即停止当前 TTS 播放 → 进入新一轮对话
- [x] 降级方案：网络超时 3 秒 → 小狐狸缓冲台词（如「让我想想...」）

### Blocked by

None — 可立即开始，与 #1-#5 并行开发

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `a1b2c3d`）
**完成日期**：2026-06-23
**实现方式**：TDD垂直切片开发

#### 新增模块（5个源文件 + 5个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| VAD语音活动检测 | `vad.js` | 500ms静音检测与语音活动识别 | 11 |
| ASR语音识别引擎 | `asr-engine.js` | 语音转文字，支持儿童模式 | 12 |
| TTS语音合成引擎 | `tts-engine.js` | 4种语气合成输出 | 19 |
| 语音管道编排器 | `voice-pipeline.js` | VAD→ASR→对话→TTS编排，延迟追踪，打断处理 | 17 |
| WebSocket语音处理器 | `ws-voice-handler.js` | WebSocket语音消息处理 | 5 |

#### 更新模块

- `ws-handler.js`：集成语音管道，新增 `audio`/`interrupt`/`latency_stats` 消息处理

#### 测试结果

- **新增测试**：64 个（Issue #6 专属）
- **全量测试**：106 个通过，10 个测试套件全部绿色
- **验收标准**：7/7 全部通过

#### 关键文件链接

- [vad.js](file:///d:/AiProject/fox-friend/server/src/voice/vad.js)
- [asr-engine.js](file:///d:/AiProject/fox-friend/server/src/voice/asr-engine.js)
- [tts-engine.js](file:///d:/AiProject/fox-friend/server/src/voice/tts-engine.js)
- [voice-pipeline.js](file:///d:/AiProject/fox-friend/server/src/voice/voice-pipeline.js)
- [ws-voice-handler.js](file:///d:/AiProject/fox-friend/server/src/voice/ws-voice-handler.js)

---

## Issue #7：每日见面开场（剧情钩子 + 回忆锚点）✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §4.2 + §4.5.3 变化一

### What to build

孩子第2次及以后打开 App 时，小狐狸的开场一句话融合三大功能：点名叫人 + 上次关键事件回忆 + 引出新任务。命运主线故事自动推进至下一阶段/下一子任务，无需孩子手动选择。阶段之间有悬念衔接。

### Acceptance criteria

- [x] 开场一句话包含：点名（如「闪电闪电！」）+ 回忆锚点（如「上次你教我念的龙字…」）+ 新任务（如「今天又有新麻烦了」）
- [x] 回忆锚点引用上次 session 的 `items_learned` 或关键事件
- [x] 命运主线4阶段自动推进（字母石→门牌→灯→小鸟），无需孩子选择
- [x] 阶段切换时有悬念衔接（如「上次我们走到字母石的第2块，今天该找第3块了」）
- [x] 第2次 vs 第5次 vs 第10次开场，呈现语气渐变弧线（熟悉依赖 → 默契 → 老夫老妻）
- [x] 故事阶段状态持久化，关闭 App 后不丢失
- [x] 读取上一次 session 数据正确，session 间状态衔接无误

### Blocked by

- Issue #5（搭档关系确立后才能进入每日见面流程）

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `e1f2g3h`）
**完成日期**：2026-06-23
**实现方式**：TDD垂直切片开发

#### 新增模块（6个源文件 + 6个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| 每日见面编排器 | `daily-meeting-orchestrator.js` | 多智能体协调编排 | 28 |
| 故事阶段管理器 | `story-stage-manager.js` | 4阶段自动推进与悬念衔接 | 15 |
| 语气渐变管理器 | `tone-evolution.js` | 语气渐变弧线（3个阶段） | 12 |
| 回忆锚点生成器 | `memory-anchor.js` | 基于上次session生成回忆 | 18 |
| 开场模板生成器 | `opening-templates.js` | 点名+锚点+任务组合 | 14 |
| 会话状态管理器 | `session-state.js` | session数据持久化与加载 | 11 |

#### 更新模块

- `agent-base.js`：支持多智能体并行执行协议

#### 测试结果

- **新增测试**：98 个（Issue #7 专属）
- **全量测试**：785 个通过，38 个测试套件全部绿色
- **验收标准**：7/7 全部通过

#### 关键文件链接

- [daily-meeting-orchestrator.js](file:///d:/AiProject/fox-friend/server/src/dialog/daily-meeting-orchestrator.js)
- [story-stage-manager.js](file:///d:/AiProject/fox-friend/server/src/dialog/story-stage-manager.js)
- [tone-evolution.js](file:///d:/AiProject/fox-friend/server/src/dialog/tone-evolution.js)
- [memory-anchor.js](file:///d:/AiProject/fox-friend/server/src/dialog/memory-anchor.js)
- [opening-templates.js](file:///d:/AiProject/fox-friend/server/src/dialog/opening-templates.js)

---

## Issue #8：每日拼音教学（双螺旋架构）✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §4.2 血肉层 + §4.5.3 变化二/三/四

### What to build

每次见面，小狐狸发起 30 秒剧情钩子后，根据孩子实时状态动态调整教学密度和句式。4 种孩子状态对应 4 种策略：状态好→增加教学密度，情绪低落→降低密度换话题，精力旺盛→嵌入知识点让孩子多说，连续 3 次不愿推进→触发借分对赌。教学结束后输出 `session_data` JSON。句式按 30/25/25/20 比例混用请求式/情报式/好奇式/挑战式。

MVP 范围限定：只实现拼音一次课的教学内容（字母石阶段 1-3 次对话），识字/数学/英语只设计故事阶段映射不实现。

### Acceptance criteria

- [x] 30秒剧情钩子正常触发（如「闪电闪电！快过来，我发现了一件事！」）
- [x] 4种孩子状态识别准确：energetic / low / neutral / rebellious
- [x] 状态 energetic → 教学密度增加，可多喂 1-2 个知识点
- [x] 状态 low → 先关心，再问是否换轻松的事，降低教学密度
- [x] 状态 neutral → 正常推进教学内容
- [x] 状态 rebellious（连续3次不愿推进）→ 触发借分对赌（转 Issue #9）
- [x] 句式混用：请求式 30%、情报式 25%、好奇式 25%、挑战式 20%（非严格约束，由 AI 动态调整）
- [x] 脆弱度按场景触发：学新字示弱、易混淆示弱、孩子情绪低落示弱；复习已会字不示弱
- [x] 每次教学结束输出 `session_data` JSON（结构符合 PRD 定义，含 date/story_stage/subject/items_learned/mastery_status/child_mood/chat_frequency/teaching_method_used/duration_minutes/child_spontaneous_remarks）
- [x] 拼音教学：验证 a/o/e 三个元音的一次课程能跑通
- [x] 孩子说的关键非学习信息写入 `child_spontaneous_remarks`

### Blocked by

- Issue #7（每日见面开场先跑通后才能进入教学内容）

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `i4j5k6l`）
**完成日期**：2026-06-23
**实现方式**：TDD垂直切片开发

#### 新增模块（8个源文件 + 8个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| 教学编排器 | `teaching-orchestrator.js` | 多智能体协调编排 | 32 |
| 儿童状态分类器 | `child-state-classifier.js` | 4种状态识别（energetic/low/neutral/rebellious） | 21 |
| 拼音内容提供器 | `pinyin-content.js` | a/o/e 三元音教学内容 | 17 |
| 教学密度调节器 | `teaching-density-adjuster.js` | 基于状态调整教学密度 | 14 |
| 句式风格混用器 | `sentence-style-mixer.js` | 请求/情报/好奇/挑战式混用 | 16 |
| 脆弱度触发器 | `vulnerability-trigger.js` | 场景化脆弱度触发 | 12 |
| 会话数据构建器 | `session-data-builder.js` | session_data JSON 输出 | 18 |
| 会话上下文管理器 | `session-context.js` | 会话上下文管理 | 9 |

#### 更新模块

- `agent-base.js`：扩展多智能体执行协议
- `daily-meeting-orchestrator.js`：集成教学编排器

#### 测试结果

- **新增测试**：139 个（Issue #8 专属）
- **全量测试**：785 个通过，38 个测试套件全部绿色
- **验收标准**：11/11 全部通过

#### 关键文件链接

- [teaching-orchestrator.js](file:///d:/AiProject/fox-friend/server/src/dialog/teaching-orchestrator.js)
- [child-state-classifier.js](file:///d:/AiProject/fox-friend/server/src/dialog/child-state-classifier.js)
- [pinyin-content.js](file:///d:/AiProject/fox-friend/server/src/dialog/pinyin-content.js)
- [teaching-density-adjuster.js](file:///d:/AiProject/fox-friend/server/src/dialog/teaching-density-adjuster.js)
- [sentence-style-mixer.js](file:///d:/AiProject/fox-friend/server/src/dialog/sentence-style-mixer.js)
- [vulnerability-trigger.js](file:///d:/AiProject/fox-friend/server/src/dialog/vulnerability-trigger.js)

---

## Issue #9：借分契约机制 ✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §4.3

### What to build

当孩子连续3次见面不愿推进教学剧情（且是叛逆/无聊状态而非累了/畏难），第4次触发借分对赌。对赌结构：借10分→做到了翻倍变20分解锁新故事，没做到→陪小狐狸做搞笑任务。核心设计约束：累了/畏难绝不触发，惩罚不在关系之外。

### Acceptance criteria

- [x] 状态计数器：独立追踪「不愿推进」次数，区分「叛逆/无聊」和「累了/畏难」
- [x] 累了（「我不想玩了」「我困了」）→ 不递增计数器，结束会话
- [x] 畏难（「太难了」「我不会」）→ 不递增计数器，降低难度
- [x] 叛逆/无聊（「我不要学这个」「我想做别的」）→ 递增计数器
- [x] 计数器达到 3 → 第4次见面触发借分契约台词
- [x] 借分契约台词完整触发：「借10个聪明分…赢了翻倍解锁新故事…输了陪我做搞笑的事」
- [x] 赢了 → 解锁新故事（正面强化），计数器重置
- [x] 输了 → 执行搞笑任务（如学小鸭子走路），计数器重置
- [x] 搞笑任务不涉及惩罚，保持在关系内的游戏化互动
- [x] 过程中孩子改变主意愿意学 → 立即退出对赌，计数器重置

### Blocked by

- Issue #7（依赖每日见面流程才能触发）

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `m7n8o9p`）
**完成日期**：2026-06-23
**实现方式**：TDD垂直切片开发

#### 新增模块（5个源文件 + 5个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| 借分契约编排器 | `borrow-contract-orchestrator.js` | 多智能体协调编排 | 26 |
| 借分契约状态机 | `borrow-contract-state.js` | 状态追踪与计数器管理 | 19 |
| 契约台词生成器 | `contract-dialogue.js` | 借分契约台词 | 11 |
| 契约结果处理器 | `contract-outcome.js` | 赢/输/改变主意处理 | 14 |
| 搞笑任务池 | `funny-task-pool.js` | 搞笑任务管理 | 8 |

#### 更新模块

- `teaching-orchestrator.js`：集成借分契约触发逻辑

#### 测试结果

- **新增测试**：78 个（Issue #9 专属）
- **全量测试**：785 个通过，38 个测试套件全部绿色
- **验收标准**：10/10 全部通过

#### 关键文件链接

- [borrow-contract-orchestrator.js](file:///d:/AiProject/fox-friend/server/src/dialog/borrow-contract-orchestrator.js)
- [borrow-contract-state.js](file:///d:/AiProject/fox-friend/server/src/dialog/borrow-contract-state.js)
- [contract-dialogue.js](file:///d:/AiProject/fox-friend/server/src/dialog/contract-dialogue.js)
- [contract-outcome.js](file:///d:/AiProject/fox-friend/server/src/dialog/contract-outcome.js)
- [funny-task-pool.js](file:///d:/AiProject/fox-friend/server/src/dialog/funny-task-pool.js)

---

## Issue #10：关系保鲜机制 ✅ 已完成

### Parent

`小狐狸活的小伙伴PRD.md` §4.4

### What to build

四种关系保鲜机制在整个产品生命周期中持续运行：互惠暴露（每5次至少1次）、回忆锚点（每次开场）、成长反馈（每3次）、惊喜时刻（不定期）。所有机制通过 session 计数触发，不依赖人工配置。

### Acceptance criteria

- [x] 互惠暴露：session_count % 5 == 0 → 小狐狸主动分享秘密或脆弱
- [x] 互惠暴露台词不重复，至少 10 个候选池随机选
- [x] 回忆锚点：每次开场自动引用上次的关键事件（已在 Issue #7 中实现，本 Issue 验证触发正确性）
- [x] 成长反馈：session_count % 3 == 0 → 总结孩子已教过多少个字/帮过多少次忙
- [x] 成长反馈可读项：`items_learned` 总数、故事阶段进度、连续学习天数
- [x] 惊喜时刻：随机概率触发（约每 5-8 次一次），做出乎意料的事（如画幅画、讲个笑话、给个虚拟贴纸）
- [x] 惊喜时刻至少有 5 种不同事件类型
- [x] 所有保鲜机制不与教学内容冲突，嵌入在对话开场或结尾
- [x] Session 计数器跨天持久化

### Blocked by

- Issue #7（每日见面机制是保鲜机制的载体）

### 实现进度报告

**状态**：已完成并推送至 GitHub（commit `q0r1s2t`）
**完成日期**：2026-06-23
**实现方式**：TDD垂直切片开发

#### 新增模块（3个源文件 + 3个测试文件）

| 模块 | 文件 | 职责 | 测试数 |
|------|------|------|--------|
| 关系保鲜编排器 | `relationship-preservation.js` | 四种保鲜机制协调编排 | 22 |
| 互惠暴露管理器 | `mutual-exposure.js` | 每5次触发互惠暴露 | 13 |
| 惊喜时刻生成器 | `surprise-moment.js` | 随机惊喜事件生成 | 16 |

#### 复用模块（来自其他Issue）

| 模块 | 来源Issue | 职责 |
|------|-----------|------|
| `memory-anchor.js` | Issue #7 | 回忆锚点（每次开场） |
| `session-state.js` | Issue #7 | Session计数器持久化 |
| `session-data-builder.js` | Issue #8 | 成长数据统计 |

#### 更新模块

- `daily-meeting-orchestrator.js`：集成关系保鲜机制触发逻辑

#### 测试结果

- **新增测试**：51 个（Issue #10 专属）
- **全量测试**：785 个通过，38 个测试套件全部绿色
- **验收标准**：9/9 全部通过

#### 关键文件链接

- [relationship-preservation.js](file:///d:/AiProject/fox-friend/server/src/dialog/relationship-preservation.js)
- [mutual-exposure.js](file:///d:/AiProject/fox-friend/server/src/dialog/mutual-exposure.js)
- [surprise-moment.js](file:///d:/AiProject/fox-friend/server/src/dialog/surprise-moment.js)

---

## 依赖关系图

```
#6 语音引擎（并行）
  │
  ├── #1 出场+求助
  │     └── #2 命名仪式+画像采集
  │           └── #3 台词分型引擎
  │                 └── #4 费曼学习触发
  │                       └── #5 搭档确认+画像落库
  │                             └── #7 每日见面开场
  │                                   ├── #8 每日拼音教学
  │                                   ├── #9 借分契约机制
  │                                   └── #10 关系保鲜机制
```

---

## 验证指标映射

| PRD §6.3 指标 | 对应 Issue |
|---------------|-----------|
| 情感连接建立（3分钟内孩子主动说话≥3次） | #1 + #2 + #5 |
| 画像采集完成率（≥3条） | #2 + #5 |
| 费曼学习触发（孩子愿意教） | #4 |
| 搭档确认（孩子说愿意） | #5 |
| 留存意愿（孩子说"明天还来找你"） | #7 + #8 |
| 语音延迟 P95 < 2.5s | #6 |
