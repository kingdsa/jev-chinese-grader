# 语文试卷 AI 评分 Demo（Vite + React + TS + TypeSafe Jev）

纯前端项目：把**学生答案**和**标准答案**交给 TypeSafe 的 **Jev（System One）** 模型判分，
每题满分、评分要点（权重）都能在界面上自定义，最终得分由代码里的公式合成。

- 判分原语：`noul`（得分点是否命中）、`choice`（选择题选项）、`score`（整体档位）
- 没有后端：请求经 **同源代理** `/api/typesafe` 转发到 `https://api.typesafe.ai/v1/systemone`
  （浏览器直连官方域名会被 CORS 拦截，`vite dev / preview` 已内置该代理）
- API Key 由使用者在前端填写，只写入本机 `localStorage`
- 内置 10 道语文题（默写、实词、翻译、鉴赏、现代文阅读、病句、成语选择、仿写、双空默写、微写作），
  每题都带 **3 组演示作答**，点一下就能看到不同水平的判分结果

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
```

1. 到 <https://console.typesafe.ai/keys> 申请 API Key（模型名默认 `jev-latest`）
2. 页面右上角「接口设置」填入 Key，点「测试连接」确认打通
3. 每题点「演示作答」里的按钮填入示例答案 → 点「批改本题」看单题判定过程
4. 或者点「一键批改全部」→「导出结果 JSON」拿到整卷成绩

```bash
npm run build        # tsc --noEmit + vite build
npm test             # vitest：判分链路的单元测试（mock Jev API，不需要真 Key）
```

## 判分是怎么算出来的

每道题会被编译成**一次** Jev 请求（`state + questions`），每题内部包含：

| 问题 key | 原语 | 作用 |
| --- | --- | --- |
| `p_0 … p_n` | `noul` | 每个评分要点一个命题：「学生答案是否拿到这个得分点」 |
| `attempt` | `noul` | 是否有效作答（空白、照抄题干、跑题会被判否） |
| `quality` | `score` | 整体与标准答案的吻合程度，档位描述写的是「情形」而不是「程度」 |
| `pick` | `choice` | 仅选择题：学生实际选了哪个选项 |

然后全部在代码里合成（`src/lib/grading.ts`）：

```
得分点覆盖率分值 = 满分 × Σ(命中得分点权重) / Σ(全部得分点权重)     // 权重合计不必等于满分
Jev 整体档位分值 = 满分 × (score / (档位数 - 1))                   // 官方要求的归一化方式
最终分 = 策略融合(覆盖率分值, 档位分值) → 四舍五入 → 裁剪到 [0, 满分]
```

- 策略可切换：`得分点覆盖率 + 档位分`（默认 7:3）/ 只用覆盖率 / 只用档位分
- 命中阈值默认 `noul ≥ 0.60`，可在设置里调
- 选择题不看覆盖率，直接按 `choice` 是否等于正确选项给满分或 0 分
- 空白答案本地直接判 0，不浪费一次请求

代码会额外给出**复核提示**，不把置信度问题藏起来：

- 某个 `noul` 落在 0.5 附近的摇摆区间
- `score` / `choice` 的 `confidence` 低于阈值
- 覆盖率分值与档位分值差异过大（两种判法打架）
- 答案类型与问题类型不匹配（运行时类型校验，见 `alignAnswers`）

## 自定义

- **满分**：卡片右上角的数字框，改完点「重新批改」即可（会提示结果已过期）
- **评分要点**：「标准答案与评分要点」里可改文字、改权重、增删得分点，权重按占比折算到满分
- **档位描述**：在 `src/data/questions.ts` 的 `levels` 里（2~10 档，必须能各自描述清楚）
- **题型/题目**：往 `QUESTION_BANK` 里加一条即可，选择题加 `choice` 字段
- 演示题库中的翻译题权重合计 5、满分 4，就是「按权重占比折算满分」的例子

## 目录结构

```
src/
  types/jev.ts        # Jev 请求/答案的判别联合类型（noul | choice | score）
  types/exam.ts       # 题库与判分结果的数据结构
  lib/jev.ts          # systemone 客户端：URL 归一化、重试/超时、类型守卫 alignAnswers
  lib/grading.ts      # 判分引擎：问题编译 + 权重合成 + 取整裁剪 + 复核提示
  data/questions.ts   # 10 道语文题 + 标准答案 + 评分要点 + 演示作答
  components/         # SettingsPanel / QuestionCard / ResultPanel / SummaryBar / ScoreRing
  App.tsx             # 状态（localStorage 持久化）、一键批改并发池、导出 JSON
  lib/grading.spec.ts # 判分链路单元测试（mock fetch）
```

## 关于 CORS（重要）

浏览器直接 `fetch https://api.typesafe.ai/v1/systemone` 会被 CORS 策略拦下，表现是：

```
TypeError: Failed to fetch
```

Network 面板的请求头里往往只看到 `Referrer Policy: strict-origin-when-cross-origin`，Responses 一栏是空的，
`Authorization` 其实已经发出去了 —— 是响应被浏览器拦掉，不是 Key 有问题。

解决办法（本项目已内置第一种）：

1. **同源代理（默认）**：Base URL 用相对路径 `/api/typesafe`，`vite.config.ts` 里已配置 dev 与 preview 代理，
   请求路径 `/api/typesafe/v1/systemone` 会被转发为 `https://api.typesafe.ai/v1/systemone`。
   想换目标地址可以 `TYPESAFE_TARGET=https://your-gateway.com npm run dev`。
2. **部署到自己的域名**：用 Nginx 之类做同样的反向代理，把 `/api/typesafe` 指向 `https://api.typesafe.ai`。
3. 如果你有开了 CORS 的自建网关（例如 `https://your-gateway.com/v1`），把 Base URL 填成绝对地址也可以。

界面上如果填的是绝对地址 `https://api.typesafe.ai`，设置面板会直接给出「改用内置代理」的一键按钮；
请求失败时错误信息里也会附带上面这段处理建议。

## 常见问题

- **Key 会泄露吗？** 不会上传到任何服务器，只存在 `localStorage`；但演示页请勿在公共电脑上长期保留。
- **429 / 5xx**：客户端自带指数退避重试（最多 2 次），失败会在题目卡片上提示原因。
- **为什么不让模型直接输出自然语言评语？** 评分要能被代码消费：类型化答案 + 概率 + 置信度，
  比解析一段文字更可靠，也更容易把阈值、权重、复核规则写死在代码里。
- **成本**：一次请求内含多个问题（并行评估），10 道题大约 10 次请求，token 数在结果面板里可见。

## 参考

- Jev 文档：<https://docs.typesafe.ai/>
- Quick start：<https://docs.typesafe.ai/introduction/quickstart>
- 三种原语：<https://docs.typesafe.ai/primitives>（Choice / Score / Noul）
- API Key 与 Playground：<https://console.typesafe.ai/>