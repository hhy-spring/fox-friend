# Trae Agent Code Wiki

> 本文档是对 [bytedance/trae-agent](https://github.com/bytedance/trae-agent) 仓库的结构化代码 Wiki，涵盖项目整体架构、主要模块职责、关键类与函数说明、依赖关系以及项目运行方式等关键信息。
>
> 技术报告：[arXiv:2507.23370](https://arxiv.org/abs/2507.23370)

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 项目整体架构](#2-项目整体架构)
- [3. 目录结构](#3-目录结构)
- [4. 主要模块职责](#4-主要模块职责)
- [5. 关键类与函数说明](#5-关键类与函数说明)
- [6. 核心执行流程](#6-核心执行流程)
- [7. 依赖关系](#7-依赖关系)
- [8. 项目运行方式](#8-项目运行方式)
- [9. 扩展机制](#9-扩展机制)

---

## 1. 项目概述

**Trae Agent** 是一个基于 LLM 的通用软件工程 Agent，由 ByteDance 团队开源（MIT 协议）。它通过 CLI 接口理解自然语言指令，借助多种工具和 LLM Provider 执行复杂的软件工程工作流（如修复 GitHub Issue、重构代码、编写测试等）。

### 核心特性

| 特性 | 说明 |
|------|------|
| 🌊 Lakeview | 为 Agent 每一步生成简短摘要与标签，便于追踪 |
| 🤖 多 LLM 支持 | OpenAI、Anthropic、Doubao、Azure、OpenRouter、Ollama、Google Gemini |
| 🛠️ 丰富工具生态 | 文件编辑、Bash 执行、结构化思考、JSON 编辑、代码知识图谱（CKG）、MCP |
| 🎯 交互模式 | 支持单次 `run` 与多轮 `interactive` 会话 |
| 📊 轨迹记录 | 详细记录 LLM 交互、Agent 步骤、工具调用，便于调试与分析 |
| ⚙️ 灵活配置 | YAML 配置 + 环境变量 + CLI 参数（三级优先级） |
| 🐳 Docker 模式 | 支持在隔离容器中执行任务 |
| 🔬 研究友好 | 透明、模块化架构，便于消融实验与二次开发 |

### 设计定位

与其它 CLI Agent 不同，Trae Agent 强调**透明、模块化**的架构，研究者可轻松修改、扩展与分析，是研究 AI Agent 架构、进行消融实验、开发新型 Agent 能力的理想平台。

---

## 2. 项目整体架构

Trae Agent 采用**分层 + 插件化**架构，自上而下分为五层：

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI 入口层 (cli.py)                       │
│        Click 命令: run / interactive / show-config / tools   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                  Agent 编排层 (agent/)                       │
│   Agent(工厂) → BaseAgent(抽象) → TraeAgent(具体实现)        │
│   agent_basics(数据结构) · docker_manager(容器管理)          │
└──────────┬────────────────────────────┬─────────────────────┘
           │                            │
┌──────────▼──────────┐     ┌───────────▼─────────────────────┐
│   工具层 (tools/)    │     │        工具支撑 (utils/)         │
│  bash / edit / json │     │  config.py      配置系统         │
│  sequential_thinking│     │  llm_clients/   多 LLM 客户端    │
│  task_done / ckg    │     │  cli/           控制台 UI        │
│  mcp / docker_exec  │     │  trajectory_recorder 轨迹记录    │
│  base(Tool/Executor)│     │  mcp_client     MCP 客户端       │
└─────────────────────┘     │  lake_view      步骤摘要         │
                            └─────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│              评估层 (evaluation/)                            │
│   SWE-bench / SWE-bench-Live / Multi-SWE-bench 评测          │
│   patch_selection 选择器 Agent                               │
└─────────────────────────────────────────────────────────────┘
```

### 架构关键设计模式

| 模式 | 应用位置 |
|------|----------|
| **工厂模式** | `Agent`（按 `agent_type` 创建具体 Agent）、`ConsoleFactory`、`LLMClient`（按 provider 创建客户端） |
| **策略模式** | LLM Provider 切换、Console 类型切换（Simple/Rich） |
| **模板方法** | `BaseAgent.execute_task()` 定义执行骨架，子类覆写钩子方法 |
| **注册表模式** | `tools_registry` 字典统一注册所有工具 |
| **适配器模式** | `MCPTool` 将 MCP 工具适配为统一 `Tool` 接口；`DockerToolExecutor` 将工具调用路由到容器 |
| **抽象基类** | `BaseAgent`、`BaseLLMClient`、`Tool`、`CLIConsole` 均为 ABC |

---

## 3. 目录结构

```
trae-agent/
├── trae_agent/                    # 核心 Python 包
│   ├── __init__.py
│   ├── cli.py                     # CLI 入口（Click 命令组）
│   ├── agent/                     # Agent 编排层
│   │   ├── __init__.py
│   │   ├── agent.py               # Agent 工厂类
│   │   ├── base_agent.py          # 抽象基类 BaseAgent
│   │   ├── trae_agent.py          # 具体实现 TraeAgent
│   │   ├── agent_basics.py        # 数据结构（AgentStep/AgentExecution 等）
│   │   └── docker_manager.py      # Docker 容器生命周期管理
│   ├── prompt/
│   │   └── agent_prompt.py        # 系统提示词
│   ├── tools/                     # 工具生态
│   │   ├── __init__.py            # tools_registry 注册表
│   │   ├── base.py                # Tool/ToolExecutor/ToolCall/ToolResult 基类
│   │   ├── bash_tool.py           # Bash 执行工具
│   │   ├── edit_tool.py           # 文件编辑工具（view/create/str_replace/insert）
│   │   ├── json_edit_tool.py      # JSON 编辑工具（JSONPath）
│   │   ├── sequential_thinking_tool.py  # 结构化思考工具
│   │   ├── task_done_tool.py      # 任务完成信号工具
│   │   ├── ckg_tool.py            # 代码知识图谱查询工具
│   │   ├── mcp_tool.py            # MCP 工具适配器
│   │   ├── docker_tool_executor.py # Docker 工具执行器
│   │   ├── run.py                 # 异步 shell 命令工具
│   │   ├── edit_tool_cli.py       # 编辑工具独立 CLI（供 Docker 打包）
│   │   ├── json_edit_tool_cli.py  # JSON 编辑工具独立 CLI（供 Docker 打包）
│   │   ├── dist/                  # PyInstaller 打包产物
│   │   └── ckg/                   # 代码知识图谱
│   │       ├── base.py            # FunctionEntry/ClassEntry 数据类
│   │       └── ckg_database.py    # SQLite + tree-sitter 构建/查询
│   └── utils/                     # 工具支撑层
│       ├── config.py              # YAML 配置系统
│       ├── constants.py           # 常量（本地存储路径）
│       ├── legacy_config.py       # 旧版 JSON 配置兼容
│       ├── trajectory_recorder.py # 轨迹记录器
│       ├── mcp_client.py          # MCP 客户端
│       ├── lake_view.py           # Lakeview 步骤摘要
│       ├── cli/                   # 控制台 UI
│       │   ├── cli_console.py     # CLIConsole 抽象基类
│       │   ├── console_factory.py # 控制台工厂
│       │   ├── simple_console.py  # 简单文本控制台
│       │   ├── rich_console.py    # Textual TUI 富控制台
│       │   └── rich_console.tcss  # Textual 样式
│       └── llm_clients/           # 多 LLM 客户端
│           ├── base_client.py     # BaseLLMClient 抽象基类
│           ├── llm_client.py      # LLMClient 统一入口（工厂）
│           ├── llm_basics.py      # LLMMessage/LLMResponse/LLMUsage
│           ├── openai_compatible_base.py  # OpenAI 兼容基类
│           ├── retry_utils.py     # 重试装饰器
│           ├── openai_client.py   # OpenAI 客户端
│           ├── anthropic_client.py# Anthropic 客户端
│           ├── azure_client.py    # Azure 客户端
│           ├── openrouter_client.py # OpenRouter 客户端
│           ├── doubao_client.py   # Doubao 客户端
│           ├── ollama_client.py   # Ollama 客户端
│           └── google_client.py   # Google Gemini 客户端
├── evaluation/                    # 评估模块
│   ├── run_evaluation.py          # 评测主入口
│   ├── utils.py                   # 评测工具与 BENCHMARK_CONFIG
│   ├── setup.sh                   # 基准测试环境搭建
│   └── patch_selection/           # 补丁选择器 Agent
│       ├── selector.py            # 选择器入口
│       ├── selector_agent.py      # 选择器 Agent
│       └── sandbox.py             # 沙箱
├── tests/                         # 单元测试
├── server/                        # HTTP Server（规划中）
├── docs/                          # 文档
├── pyproject.toml                 # 项目元数据与依赖
├── Makefile                       # 开发命令
├── trae_config.yaml.example       # 配置示例
└── README.md
```

---

## 4. 主要模块职责

### 4.1 CLI 入口层 — `trae_agent/cli.py`

基于 [Click](https://click.palletsprojects.com/) 构建的命令行入口，注册了 `trae-cli` 命令（见 `pyproject.toml` 中 `[project.scripts]`）。

| 命令 | 职责 |
|------|------|
| `trae-cli run <task>` | 单次执行任务，支持 provider/model/docker 等大量参数 |
| `trae-cli interactive` | 启动多轮交互会话（Simple 或 Rich TUI） |
| `trae-cli show-config` | 展示当前配置（provider、model、token 限制等） |
| `trae-cli tools` | 列出所有可用工具及描述 |

关键辅助函数：
- `resolve_config_file()` — YAML/JSON 配置文件向后兼容解析
- `check_docker()` — 检测 Docker CLI 与守护进程可用性
- `build_with_pyinstaller()` — 用 PyInstaller 打包工具二进制（Docker 模式首次使用时触发）
- `_run_simple_interactive_loop()` / `_run_rich_interactive_loop()` — 两种交互循环

### 4.2 Agent 编排层 — `trae_agent/agent/`

负责 Agent 的生命周期管理与执行循环。

| 文件 | 职责 |
|------|------|
| `agent.py` | `Agent` 工厂类，根据 `AgentType` 创建具体 Agent，串联轨迹记录、CLI 控制台、MCP 初始化 |
| `base_agent.py` | `BaseAgent` 抽象基类，定义 `execute_task()` 执行循环（思考→调用工具→反思→完成），管理工具执行器、Docker、轨迹记录 |
| `trae_agent.py` | `TraeAgent` 具体实现，针对软件工程任务，覆写任务完成判定、MCP 发现、git diff 生成等 |
| `agent_basics.py` | 数据结构：`AgentStep`、`AgentExecution`、`AgentState`、`AgentStepState`、`AgentError` |
| `docker_manager.py` | `DockerManager` 管理容器生命周期（构建/附加/启动/停止）与持久化 shell 执行 |

### 4.3 工具层 — `trae_agent/tools/`

提供 Agent 可调用的工具集合，所有工具继承自 `Tool` 抽象基类。

| 工具 | 注册名 | 职责 |
|------|--------|------|
| `BashTool` | `bash` | 在持久化 bash 会话中执行命令（120s 超时，支持重启） |
| `TextEditorTool` | `str_replace_based_edit_tool` | 文件查看/创建/字符串替换/行插入 |
| `JSONEditTool` | `json_edit_tool` | 基于 JSONPath 的 JSON 文件查看/设置/添加/删除 |
| `SequentialThinkingTool` | `sequentialthinking` | 结构化分步思考，支持修订与分支 |
| `TaskDoneTool` | `task_done` | 标记任务完成（Agent 据此终止循环） |
| `CKGTool` | `ckg` | 查询代码知识图谱（函数/类/方法搜索） |
| `MCPTool` | 动态 | 适配外部 MCP 服务器提供的工具 |

支撑组件：
- `base.py` — `Tool`、`ToolExecutor`（顺序/并行执行）、`ToolCall`、`ToolResult`、`ToolParameter`
- `docker_tool_executor.py` — `DockerToolExecutor` 将 `bash`/`edit`/`json_edit` 路由到容器内执行，自动翻译主机路径到容器路径
- `run.py` — 异步 shell 命令执行 + 输出截断（`maybe_truncate`，上限 16000 字符）
- `ckg/` — 基于 tree-sitter 解析 + SQLite 存储的代码知识图谱，支持 Python/Java/C/C++/TypeScript/JavaScript

### 4.4 工具支撑层 — `trae_agent/utils/`

#### 4.4.1 配置系统 — `config.py`

基于 YAML 的分层配置，核心数据类：

```
Config
├── model_providers: dict[str, ModelProvider]   # API 凭证
├── models: dict[str, ModelConfig]              # 模型参数
├── lakeview: LakeviewConfig | None             # Lakeview 配置
└── trae_agent: TraeAgentConfig | None          # Agent 配置
        ├── model: ModelConfig
        ├── max_steps: int
        ├── tools: list[str]
        ├── enable_lakeview: bool
        ├── allow_mcp_servers: list[str]
        └── mcp_servers_config: dict[str, MCPServerConfig]
```

配置优先级：**CLI 参数 > 配置文件 > 环境变量 > 默认值**（由 `resolve_config_value()` 实现）。

支持旧版 JSON 配置向后兼容（`create_from_legacy_config()` → `LegacyConfig`）。

#### 4.4.2 LLM 客户端 — `utils/llm_clients/`

统一的多 Provider 抽象：

```
LLMClient (统一入口/工厂，按 provider 分发)
    └── BaseLLMClient (抽象基类)
            ├── OpenAICompatibleClient (OpenAI 兼容基类)
            │       ├── OpenRouterClient   (ProviderConfig: OpenRouterProvider)
            │       ├── DoubaoClient       (ProviderConfig: DoubaoProvider)
            │       └── AzureClient        (ProviderConfig: AzureProvider, 用 AzureOpenAI)
            ├── OpenAIClient      (直接继承，用 Responses API)
            ├── AnthropicClient   (直接继承，原生 SDK)
            ├── OllamaClient      (直接继承，原生 ollama SDK)
            └── GoogleClient      (直接继承，原生 google-genai SDK)
```

- `llm_basics.py` — 标准消息格式 `LLMMessage`、响应 `LLMResponse`、用量 `LLMUsage`（支持累加）
- `retry_utils.py` — `retry_with()` 装饰器，随机退避（3-30s）重试
- 所有客户端均支持工具调用与轨迹记录

#### 4.4.3 控制台 UI — `utils/cli/`

```
CLIConsole (抽象基类)
├── SimpleCLIConsole   # 基于 rich 的文本输出，适合 run 模式
└── RichCLIConsole     # 基于 Textual 的 TUI，含输入框、token 实时显示，适合 interactive 模式
```

`ConsoleFactory` 按 `ConsoleMode`（RUN/INTERACTIVE）推荐类型：INTERACTIVE → RICH，RUN → SIMPLE。

#### 4.4.4 轨迹记录 — `trajectory_recorder.py`

`TrajectoryRecorder` 将每次执行序列化为 JSON 文件（默认 `trajectories/trajectory_YYYYMMDD_HHMMSS.json`），记录：
- 任务元信息（task、provider、model、max_steps、起止时间）
- `llm_interactions`：每轮 LLM 交互的输入消息、响应、用量、可用工具
- `agent_steps`：每个 Agent 步骤的状态、工具调用、结果、反思、错误、lakeview 摘要

#### 4.4.5 MCP 客户端 — `mcp_client.py`

`MCPClient` 通过 [Model Context Protocol](https://modelcontextprotocol.io/) 接入外部工具服务器（目前实现 stdio 传输），自动发现服务器提供的工具并包装为 `MCPTool`。

#### 4.4.6 Lakeview — `lake_view.py`

`LakeView` 利用独立的 LLM 为每个 Agent 步骤生成：
- **任务摘要**（`<task>` + `<details>`）：当前步骤在做什么
- **标签**（8 类）：`WRITE_TEST`/`VERIFY_TEST`/`EXAMINE_CODE`/`WRITE_FIX`/`VERIFY_FIX`/`REPORT`/`THINK`/`OUTLIER`，配 emoji 显示

### 4.5 评估层 — `evaluation/`

| 组件 | 职责 |
|------|------|
| `run_evaluation.py` | `BenchmarkEvaluation` 主类，管理 Docker 镜像、准备 Trae Agent、生成补丁、运行评测 |
| `utils.py` | `BENCHMARK_CONFIG` 注册表（SWE-bench / SWE-bench-Live / Multi-SWE-bench），含数据集加载、镜像命名、评测命令构造 |
| `setup.sh` | 克隆并安装基准测试 harness |
| `patch_selection/` | 选择器 Agent：从多个补丁候选中选出最优（分组 + 多数投票） |

支持三种模式：`expr`（仅生成补丁）、`eval`（仅评测）、`e2e`（端到端，默认）。

---

## 5. 关键类与函数说明

### 5.1 Agent 层

#### `Agent`（`agent/agent.py`）
工厂 + 门面类，对外暴露统一接口。

```python
class Agent:
    def __init__(self, agent_type, config, trajectory_file=None,
                 cli_console=None, docker_config=None, docker_keep=True)
    async def run(self, task, extra_args=None, tool_names=None) -> AgentExecution
```
- 构造时按 `AgentType` 创建具体 Agent（目前仅 `TraeAgent`）
- `run()` 完成 MCP 初始化 → 打印任务详情 → 启动控制台 → `execute_task()` → MCP 清理

#### `BaseAgent`（`agent/base_agent.py`）
抽象基类，定义执行循环模板。

| 成员 | 说明 |
|------|------|
| `_llm_client: LLMClient` | LLM 客户端 |
| `_tools: list[Tool]` | 工具列表（从 `tools_registry` 实例化） |
| `_tool_caller: ToolExecutor \| DockerToolExecutor` | 工具执行器（按是否 Docker 模式切换） |
| `execute_task() -> AgentExecution` | **核心循环**：`while step <= max_steps`：`_run_llm_step` → `_finalize_step`，完成或出错则退出 |
| `_run_llm_step()` | 调用 LLM → 判断是否完成 → 否则进入 `_tool_call_handler` |
| `_tool_call_handler()` | 按 `parallel_tool_calls` 配置并行/顺序执行工具，组装结果消息，触发反思 |
| `llm_indicates_task_completed()` | 默认按关键词检测；`TraeAgent` 覆写为检测 `task_done` 工具调用 |
| `new_task()` | 抽象方法，子类构建初始消息 |

#### `TraeAgent`（`agent/trae_agent.py`）
软件工程专用 Agent。

| 方法 | 说明 |
|------|------|
| `new_task()` | 组装 system prompt + 用户消息（项目路径 + Issue 描述），启动轨迹记录 |
| `execute_task()` | 调用父类循环后，finalize 轨迹、可选写出 patch 文件 |
| `llm_indicates_task_completed()` | 检测 LLM 是否调用了 `task_done` 工具 |
| `_is_task_completed()` | 若 `must_patch=true`，校验 git diff 非空（且剔除测试目录改动） |
| `get_git_diff()` | 获取项目 git diff（相对 base_commit 或工作区） |
| `remove_patches_to_tests()` | 从 patch 中移除测试目录改动（源自 Aider，Apache-2.0） |
| `discover_mcp_tools()` | 遍历允许的 MCP 服务器，发现并注册工具 |
| `cleanup_mcp_clients()` | 清理所有 MCP 客户端，防止异步上下文泄漏 |

#### `DockerManager`（`agent/docker_manager.py`）
| 方法 | 说明 |
|------|------|
| `start()` | 按 dockerfile/image-file/container-id/image 之一启动或附加容器，挂载工作区，拷贝工具，启动持久化 shell |
| `execute(command, timeout)` | 通过 pexpect 在持久化 bash 中执行命令，用 marker 捕获退出码 |
| `stop()` | 关闭 shell，停止并移除自管理的容器 |
| `CONTAINER_TOOLS_PATH = "/agent_tools"` | 容器内工具固定路径 |

### 5.2 工具层

#### `Tool`（`tools/base.py`）— 抽象基类
```python
class Tool(ABC):
    def get_name(self) -> str           # 抽象
    def get_description(self) -> str    # 抽象
    def get_parameters(self) -> list[ToolParameter]  # 抽象
    async def execute(self, arguments) -> ToolExecResult  # 抽象
    def get_input_schema(self) -> dict  # 生成 JSON Schema（OpenAI strict 模式特殊处理）
    async def close(self)               # 资源释放钩子
```

#### `ToolExecutor`（`tools/base.py`）
- `execute_tool_call(tool_call)` — 名称归一化（小写 + 去下划线）后查找并执行
- `parallel_tool_call()` / `sequential_tool_call()` — `asyncio.gather` 并行或顺序
- `close_tools()` — 释放所有工具资源（如 BashTool 的子进程）

#### `BashTool`（`tools/bash_tool.py`）
- 内部 `_BashSession` 维护持久化 `asyncio.subprocess`，用 sentinel 串捕获退出码
- 支持 `restart` 参数重置会话；`close()` 终止子进程
- 跨平台：Unix 用 `/bin/bash`，Windows 用 `cmd.exe /v:on`

#### `TextEditorTool`（`tools/edit_tool.py`）
四种子命令：`view`（`cat -n` 风格 + 行范围）、`create`（文件已存在则失败）、`str_replace`（要求 `old_str` 唯一）、`insert`（按行号插入）。所有路径必须绝对路径。

#### `JSONEditTool`（`tools/json_edit_tool.py`）
基于 `jsonpath_ng` 的 JSON 编辑：`view`/`set`/`add`/`remove`，支持递归下降 `..key`、数组切片等。

#### `CKGDatabase`（`tools/ckg/ckg_database.py`）
- 用 tree-sitter 解析源码 AST，递归访问提取函数/类/方法，存入 SQLite
- 通过 git commit hash 或文件元数据 hash 做快照缓存（过期 1 周自动清理）
- `query_function()` / `query_class()` 按标识符查询

### 5.3 配置与 LLM 层

#### `Config.create()`（`utils/config.py`）
类方法，解析 YAML：`model_providers` → `models` → `lakeview` → `mcp_servers` → `agents`，校验引用关系，返回 `Config` 实例。

#### `LLMClient`（`utils/llm_clients/llm_client.py`）
```python
class LLMClient:
    def __init__(self, model_config: ModelConfig)
        # 按 provider match 创建具体客户端
    def chat(self, messages, model_config, tools=None, reuse_history=True) -> LLMResponse
```

#### `OpenAICompatibleClient`（`utils/llm_clients/openai_compatible_base.py`）
OpenAI 兼容 Provider 的共享基类，配合 `ProviderConfig` 抽象（`create_client`/`get_extra_headers`/`supports_tool_calling`）。处理消息格式转换、工具 schema 生成、重试、轨迹记录、历史管理。

### 5.4 控制台与轨迹

#### `CLIConsole`（`utils/cli/cli_console.py`）
抽象基类，定义 `start`/`update_status`/`print_task_details`/`print`/`get_task_input`/`get_working_dir_input`/`stop` 等接口。`AGENT_STATE_INFO` 映射状态到颜色与 emoji。

#### `TrajectoryRecorder`（`utils/trajectory_recorder.py`）
- `start_recording()` / `record_llm_interaction()` / `record_agent_step()` / `finalize_recording()`
- 每次记录后立即 `save_trajectory()` 落盘（即使中途崩溃也有部分轨迹）

---

## 6. 核心执行流程

以 `trae-cli run "Fix the bug in main.py"` 为例：

```
1. cli.py: run()
   ├── 解析参数 → resolve_config_file() → Config.create().resolve_config_values()
   ├── 构建 docker_config（可选）→ check_docker() + build_with_pyinstaller()
   ├── ConsoleFactory.create_console() → cli_console
   ├── Agent(agent_type, config, trajectory_file, cli_console, docker_config)
   └── asyncio.run(agent.run(task, task_args))

2. Agent.run()
   ├── agent.new_task(task, extra_args)        # TraeAgent 组装 system+user 消息
   ├── initialise_mcp()                         # 发现并注册 MCP 工具
   ├── cli_console.print_task_details()
   ├── asyncio.create_task(cli_console.start()) # 后台启动控制台
   └── agent.execute_task()

3. BaseAgent.execute_task()  ← 核心循环
   while step_number <= max_steps:
   │
   ├─ _run_llm_step(step, messages, execution)
   │    ├─ step.state = THINKING → update CLI
   │    ├─ llm_response = LLMClient.chat(messages, config, tools)
   │    ├─ 累加 token 用量
   │    └─ if llm_indicates_task_completed(llm_response):
   │          if _is_task_completed():  # TraeAgent 校验 patch 非空
   │              execution.agent_state = COMPLETED; return
   │          else: 返回 "Patch is empty" 提示，继续循环
   │       else:
   │          messages = _tool_call_handler(tool_calls, step)
   │
   ├─ _tool_call_handler()
   │    ├─ step.state = CALLING_TOOL
   │    ├─ parallel_tool_call / sequential_tool_call  # 经 DockerToolExecutor 或 ToolExecutor
   │    ├─ 将每个 ToolResult 包装为 LLMMessage(role=user, tool_result=...)
   │    └─ reflect_on_result() → 可选反思消息
   │
   └─ _finalize_step()  # 记录轨迹 + 更新 CLI + steps.append

4. 循环结束：
   ├── _close_tools()（释放 BashTool 子进程等）
   ├── cleanup_mcp_clients()
   ├── TraeAgent.execute_task()：finalize_recording() + 可选写出 patch
   └── cli.py 打印轨迹保存路径
```

### 任务完成判定（TraeAgent 特色）

`TraeAgent` 不依赖关键词，而是检测 LLM 是否调用了 `task_done` 工具。若 `must_patch=true`，还会调用 `get_git_diff()` 验证补丁非空（并剔除测试目录改动），空补丁则提示 `"ERROR! Your Patch is empty."` 让 Agent 继续。

---

## 7. 依赖关系

### 7.1 内部模块依赖

```
cli.py
  └─ agent/ (Agent, TraeAgent)
       ├─ tools/ (tools_registry, Tool, ToolExecutor, DockerToolExecutor, CKG)
       ├─ utils/config (Config, TraeAgentConfig)
       ├─ utils/llm_clients (LLMClient → 各 Provider 客户端)
       ├─ utils/cli (CLIConsole → Simple/Rich)
       ├─ utils/trajectory_recorder (TrajectoryRecorder)
       ├─ utils/mcp_client (MCPClient → MCPTool)
       ├─ utils/lake_view (LakeView，由 CLIConsole 持有)
       └─ prompt/agent_prompt (系统提示词)
```

### 7.2 外部依赖（`pyproject.toml`）

| 依赖 | 用途 |
|------|------|
| `openai>=1.86.0` | OpenAI / Azure / OpenRouter / Doubao 客户端 |
| `anthropic>=0.54.0,<=0.60.0` | Anthropic 客户端 |
| `google-genai>=1.24.0` | Google Gemini 客户端 |
| `ollama>=0.5.1` | Ollama 本地模型客户端 |
| `click>=8.0.0` / `asyncclick>=8.0.0` | CLI 框架 |
| `pydantic>=2.0.0` | 数据校验 |
| `pyyaml>=6.0.2` | YAML 配置解析 |
| `python-dotenv>=1.0.0` | `.env` 加载 |
| `rich>=13.0.0` | 终端美化输出 |
| `textual>=0.50.0` | Rich TUI 框架 |
| `jsonpath-ng>=1.7.0` | JSONPath 解析（JSONEditTool） |
| `tree-sitter==0.21.3` / `tree-sitter-languages==1.10.2` | 代码 AST 解析（CKG） |
| `mcp==1.12.2` | Model Context Protocol 客户端 |
| `socksio>=1.0.0` | SOCKS 代理支持 |
| `ruff>=0.12.4` | 代码格式化与 lint |
| `pyinstaller==6.15.0` | 打包工具二进制（Docker 模式） |

可选依赖：
- `test`：pytest、pytest-asyncio、pytest-mock、pytest-cov、pre-commit
- `evaluation`：datasets、docker、pexpect、unidiff

### 7.3 运行时外部依赖

- **Python 3.12+**
- **UV**（包管理器，推荐）
- **LLM API Key**（至少一个 Provider）
- **Docker**（仅 Docker 模式或评估时需要）
- **Git**（生成 patch、CKG 快照 hash）

---

## 8. 项目运行方式

### 8.1 安装

```bash
git clone https://github.com/bytedance/trae-agent.git
cd trae-agent
uv sync --all-extras
source .venv/bin/activate
```

### 8.2 配置

复制示例配置并编辑：

```bash
cp trae_config.yaml.example trae_config.yaml
```

`trae_config.yaml` 核心结构：

```yaml
agents:
  trae_agent:
    enable_lakeview: true
    model: trae_agent_model        # 引用 models 下的配置名
    max_steps: 200
    tools:
      - bash
      - str_replace_based_edit_tool
      - sequentialthinking
      - task_done
allow_mcp_servers:                  # 允许接入的 MCP 服务器名
  - playwright
mcp_servers:                        # MCP 服务器定义
  playwright:
    command: npx
    args: ["@playwright/mcp@0.0.27"]
lakeview:
  model: lakeview_model             # Lakeview 用的模型

model_providers:                    # API 凭证
  anthropic:
    api_key: your_anthropic_api_key
    provider: anthropic
  openai:
    api_key: your_openai_api_key
    provider: openai
    base_url: https://api.openai.com/v1   # 可选

models:                             # 模型参数
  trae_agent_model:
    model_provider: anthropic
    model: claude-sonnet-4-20250514
    max_tokens: 4096
    temperature: 0.5
    top_p: 1
    top_k: 0
    max_retries: 10
    parallel_tool_calls: true
  lakeview_model:
    model_provider: anthropic
    model: claude-3.5-sonnet
    ...
```

也可用环境变量（`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`GOOGLE_API_KEY`、`OPENROUTER_API_KEY`、`DOUBAO_API_KEY` 等，对应 `*_BASE_URL`）。

> **配置优先级**：CLI 参数 > 配置文件 > 环境变量 > 默认值

### 8.3 基本使用

```bash
# 单次任务
trae-cli run "Create a hello world Python script"

# 指定 provider/model
trae-cli run "Fix the bug in main.py" --provider openai --model gpt-4o
trae-cli run "Add unit tests" --provider anthropic --model claude-sonnet-4-20250514
trae-cli run "Comment this code" --provider ollama --model qwen3

# 从文件读取任务
trae-cli run --file task_description.txt

# 自定义工作目录
trae-cli run "Add tests" --working-dir /path/to/project

# 保存轨迹到指定文件
trae-cli run "Debug authentication" --trajectory-file debug_session.json

# 强制生成 patch
trae-cli run "Update API endpoints" --must-patch

# 交互模式
trae-cli interactive --provider openai --model gpt-4o --max-steps 30

# 查看配置 / 工具
trae-cli show-config
trae-cli tools
```

### 8.4 Docker 模式

```bash
# 用指定镜像在新容器运行
trae-cli run "Add tests" --docker-image python:3.11

# 挂载工作目录
trae-cli run "write a script" --docker-image python:3.12 --working-dir test_workdir/

# 附加到已有容器
trae-cli run "Update API" --docker-container-id 91998a56056c

# 用 Dockerfile 构建
trae-cli run "Debug auth" --dockerfile-path test_workspace/Dockerfile

# 加载本地镜像 tar
trae-cli run "Fix bug" --docker-image-file test_workspace/custom.tar

# 任务结束后移除容器（默认保留）
trae-cli run "Add tests" --docker-image python:3.11 --docker-keep false
```

> 首次使用 Docker 模式会自动用 PyInstaller 打包 `edit_tool`/`json_edit_tool` 二进制到 `trae_agent/dist/`，并拷贝到容器 `/agent_tools`。

### 8.5 交互模式命令

在 `interactive` 模式下可输入：任意任务描述执行、`status`（查看 Agent 状态）、`help`、`clear`、`exit`/`quit`。

### 8.6 评估运行

```bash
uv sync --extra evaluation
cd evaluation
./setup.sh swe_bench        # 或 swe_bench_live / multi_swe_bench

# 端到端评测
python run_evaluation.py --dataset SWE-bench_Verified --working-dir ./trae-workspace

# 仅生成补丁 / 仅评测
python run_evaluation.py --mode expr --dataset SWE-bench_Verified
python run_evaluation.py --mode eval --benchmark-harness-path ./SWE-bench
```

### 8.7 开发命令（Makefile）

```bash
make install-dev      # 创建 venv 并安装全部依赖
make uv-test          # 运行测试（跳过外部服务测试）
make pre-commit       # 安装并运行 pre-commit
make fix-format       # ruff 格式化 + 修复
make clean            # 清理构建产物
```

---

## 9. 扩展机制

Trae Agent 的模块化设计便于扩展：

### 9.1 新增工具

1. 创建继承 `Tool` 的类，实现 `get_name()`/`get_description()`/`get_parameters()`/`execute()`
2. 在 `tools/__init__.py` 的 `tools_registry` 中注册
3. 在 `trae_config.yaml` 的 `tools` 列表中启用

### 9.2 新增 LLM Provider

- **OpenAI 兼容**：定义 `ProviderConfig` 子类 + 继承 `OpenAICompatibleClient`（参考 `DoubaoClient`）
- **原生 SDK**：直接继承 `BaseLLMClient`，实现 `chat()`/`set_chat_history()`/`parse_messages()`（参考 `GoogleClient`）
- 在 `LLMProvider` 枚举与 `LLMClient.__init__` 的 match 中登记

### 9.3 新增 Agent 类型

1. 继承 `BaseAgent`，实现 `new_task()` 与 `cleanup_mcp_clients()`
2. 在 `AgentType` 枚举与 `Agent.__init__` 的 match 中登记
3. 在 `cli.py` 的 `--agent-type` 选项中添加

### 9.4 接入 MCP 服务

在 `trae_config.yaml` 添加 `mcp_servers` 配置（command + args），并在 `allow_mcp_servers` 中允许即可，工具会自动发现。

### 9.5 自定义控制台

继承 `CLIConsole`，实现抽象方法，在 `ConsoleFactory` 与 `ConsoleType` 中登记。

---

## 附：路线图（摘自 `docs/roadmap.md`）

- **SDK 开发**：无 CLI 依赖的编程式 API + 流式轨迹记录
- **沙箱环境**：隔离/并行任务执行
- **轨迹分析**：集成 W&B Weave / MLFlow
- **工具与 MCP**：Jupyter Notebook 支持、标准化 MCP
- **多 Agent 流**：多 Agent 协作与专业化

---

*本文档基于仓库源码分析生成，反映代码当前状态。*
