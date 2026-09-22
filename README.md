# 多学科试卷 AI 评分 Demo（Vite + React + TS + TypeSafe Jev）

纯前端项目：把**学生答案**和**标准答案**交给 TypeSafe 的 **Jev（System One）** 模型判分，
每题满分、评分要点（权重）都能在界面上自定义，最终得分由代码里的公式合成。

- 科目：**语文、数学、化学、生物、英语（只看作文）、地理、历史**，每个科目 10 道演示题，
  每题都带 **3 组演示作答**，点一下就能看到不同水平的判分结果
- 题库全部是**填空、解答、材料分析、写作**这类主观题，没有选择题，学生要写出答案内容或过程
- **每题都能上传学生答题截图**：先用 OpenAI 兼容的视觉模型（自己填 base_url / api_key / model）把
  截图转成文字，填入「学生作答」后自动交给 Jev 判分；识别文字可人工修改后再重新批改
- 判分原语：`noul`（得分点是否命中）、`score`（整体档位）；`choice`（选择题选项）代码仍然保留，
  但演示题库默认不使用
- 科目之间独立统计、独立导出，作答与结果按科目分别存在浏览器 `localStorage`
- 没有后端：Jev 请求经 **同源代理** `/api/typesafe` 转发到 `https://api.typesafe.ai/v1/systemone`；
  识图请求经 `/api/vision-proxy` **动态代理**转发到你自己填的模型网关
  （浏览器直连第三方网关常被 CORS 拦截，`vite dev / preview` 已内置这两个代理）
- API Key 由使用者在前端填写，只写入本机 `localStorage`

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5199
```

1. 到 <https://console.typesafe.ai/keys> 申请 Jev API Key（模型名默认 `jev-latest`）
2. 页面右上角「接口设置」填入 Key，点「测试连接」确认打通
3. 同一面板的「识图模型」区填 OpenAI 兼容的 Base URL / API Key / 模型名（如 `https://api.openai.com/v1`
   + `gpt-4o-mini`，或 DashScope、豆包、硅基流动等任一兼容网关），点「测试识图连接」确认打通
4. 用科目栏切换题库；每题点「演示作答」里的按钮填入示例答案，或直接上传答题截图 → 点「批改本题」看单题判定过程
5. 或者点「一键批改全部」→「导出结果 JSON」拿到该科目的整卷成绩

## 答题截图 → 识图模型 → Jev 判分

判分链路的输入必须是**可编辑、可审计的文字**，所以截图不直接丢给 Jev，而是分两步：

```
答题截图（1~4 张）→ OpenAI 兼容视觉模型 chat/completions → 转写文字 →（自动）填入学生作答 → Jev 判分
```

- 上传方式：点「演示作答」后面的「上传答题截图」按钮，或在作答框里直接 `Ctrl·V` 粘贴截图；
  上传后原地显示缩略图，可点击查看大图（点空白处或按 Esc 关闭）、单张删除或继续上传
- 数学第 10 题（导数综合）自带一张**演示学生手写解答截图**（`public/demo/math-q10-answer.jpg`）：
  点「演示截图（手写解答）」chip 就会把它载入识别流程，走的是和用户上传完全一样的链路；
  载入后可以删除再换自己的截图
- 识别前后的图片只存在内存里，**不会写进 localStorage、也不会发给 Jev**；转写出的文字会留在本机，
  导出的 JSON 里带 `answer_source` 与 `screenshot` 字段，可追溯到模型、文件名、耗时
- 提示词要求模型「只转写、不解答、不补全」：公式转 LaTeX、表格转 Markdown、看不清标 `[?]`、
  没有作答时返回 `NO_ANSWER`（按空白作答处理，本地判 0）；给模型的上下文只有题干，**不给标准答案**，
  避免它顺手把学生答案「改对」
- 设置里可关掉「识别完成后自动提交 Jev 批改本题」，改成先人工校对文字再手动批改
- 图片预处理：长边超过 1600px 先等比缩小并转 JPEG，单张上限 12 MB，一次最多 4 张
- 请求体只用最通用的字段（`model` / `messages` / `image_url`），不发 `temperature`、`max_tokens`，
  尽量避免各家网关与 o 系列模型的参数限制；Base URL 填 `https://api.openai.com`、`.../v1` 或完整
  `.../chat/completions` 都能识别

```bash
npm run build        # tsc --noEmit + vite build
npm test             # vitest：判分链路单测 + 题库完整性检查（mock Jev API，不需要真 Key）
```

## 各科目题型

| 科目 | 题型构成 |
| --- | --- |
| 语文 | 默写、文言实词、文言翻译、古诗鉴赏、现代文阅读、病句修改、成语判断修改、仿写、双空默写、微写作 |
| 数学 | 3 填空 + 7 解答（复数、导数、概率、二项式、圆锥曲线、解三角形、数列、立体几何、统计、导数综合） |
| 化学 | 4 填空 + 6 解答（STSE/NA、离子方程式、元素周期律、有机物、实验装置、电化学、平衡、工业流程、滴定、有机推断） |
| 生物 | 4 填空 + 6 解答（细胞结构、酶、遗传、调节、光合呼吸、基因工程、代谢计算、基因定位、神经体液免疫、生态系统） |
| 英语 | 10 篇写作：6 应用文 + 3 读后续写 + 1 议论文（只批作文） |
| 地理 | 4 填空 + 6 解答（地球运动、天气系统、洋流、人文区位、等值线、气候、地貌成因、产业转移、区域转型、荒漠化） |
| 历史 | 3 填空 + 7 解答（古代制度、近代救亡、世界思想、新中国、史料价值、近代经济、选官制度、人文精神、观点论述、世界格局） |

## 判分是怎么算出来的

每道题会被编译成**一次** Jev 请求（`state + questions`），每题内部包含：

| 问题 key | 原语 | 作用 |
| --- | --- | --- |
| `p_0 … p_n` | `noul` | 每个评分要点一个命题：「学生答案是否拿到这个得分点」 |
| `attempt` | `noul` | 是否有效作答（空白、照抄题干、跑题会被判否） |
| `quality` | `score` | 整体与标准答案的吻合程度，档位描述写的是「情形」而不是「程度」 |
| `pick` | `choice` | 仅选择题：学生实际选了哪个选项（演示题库未使用，保留能力） |

`state.subject` 与 instructions 会按当前科目生成；每个科目还有一份判分约定（`guidance`），
追加到得分点的 instructions 里，比如数学「等价变形、不同解法都算正确，答案对而无过程只给答案分」、
化学「方程式必须配平但允许等价写法」、英语「只按学生文本判内容要点和词数，语言质量走整体档位」。

然后全部在代码里合成（`src/lib/grading.ts`）：

```
得分点覆盖率分值 = 满分 × Σ(命中得分点权重) / Σ(全部得分点权重)     // 权重合计不必等于满分
Jev 整体档位分值 = 满分 × (score / (档位数 - 1))                   // 官方要求的归一化方式
最终分 = 策略融合(覆盖率分值, 档位分值) → 四舍五入 → 裁剪到 [0, 满分]
```

- 策略可切换：`得分点覆盖率 + 档位分`（默认 7:3）/ 只用覆盖率 / 只用档位分
- 命中阈值默认 `noul ≥ 0.60`，可在设置里调
- 若题目配置了 `choice`，则不看覆盖率，直接按选项是否等于正确选项给满分或 0 分
- 空白答案本地直接判 0，不浪费一次请求

代码会额外给出**复核提示**，不把置信度问题藏起来：

- 某个 `noul` 落在 0.5 附近的摇摆区间
- `score` / `choice` 的 `confidence` 低于阈值
- 覆盖率分值与档位分值差异过大（两种判法打架）
- 答案类型与问题类型不匹配（运行时类型校验，见 `alignAnswers`）

## 自定义

- **科目**：顶部科目栏切换；每个科目独立总分、独立导出 `jev-grading-<科目>.json`
- **满分**：卡片右上角的数字框，改完点「重新批改」即可（会提示结果已过期）
- **评分要点**：「标准答案与评分要点」里可改文字、改权重、增删得分点，权重按占比折算到满分
- **档位描述**：在 `src/data/subjects/<科目>.ts` 的 `levels` 里（2~10 档，必须能各自描述清楚）
- **识图提示词**：`src/lib/vision.ts` 的 `VISION_SYSTEM_PROMPT`（转写规则）与 `buildVisionPrompt`（题目上下文），
  想让它输出更多结构（例如按小问分段）改这里
- **演示截图**：把图片放进 `public/demo/`，在对应题目的 `demoScreenshot` 里写 `{ label, src: '/demo/xxx.jpg' }`，
  界面上就会出现一个载入演示截图的 chip（`subjects.spec.ts` 会校验文件真实存在）
- **题目**：往对应科目的题库数组里加一条即可；填空/解答/写作题写清 `rubric` 得分点，若确实需要选择题再补 `choice` 字段
- **新科目**：仿照 `src/data/subjects/math.ts` 建文件，在 `src/data/subjects/index.ts` 的 `SUBJECTS`
  里注册（`label` / `promptLabel` / `blurb` / `guidance` + 题库），题目 id 用 `<科目>-q1` 前缀避免冲突
- 演示题库中的语文翻译题权重合计 5、满分 4，就是「按权重占比折算满分」的例子

## 目录结构

```
public/
  demo/                 # 题库内置的演示学生作答截图（构建时原样拷贝）
src/
  types/jev.ts          # Jev 请求/答案的判别联合类型（noul | choice | score）
  types/vision.ts       # 识图设置、识别结果与截图识别元信息
  types/exam.ts         # 题库、科目配置、作答来源与判分结果的数据结构
  lib/jev.ts            # systemone 客户端：URL 归一化、重试/超时、类型守卫 alignAnswers
  lib/vision.ts         # 识图客户端：OpenAI 兼容 chat/completions、端点归一化、图片压缩、提示词
  lib/grading.ts        # 判分引擎：按科目编译问题 + 权重合成 + 取整裁剪 + 复核提示
  data/subjects/
    index.ts            # 科目注册表：SUBJECTS（label/promptLabel/blurb/guidance + 题库）
    chinese.ts          # 10 道语文题
    math.ts             # 10 道数学题
    chemistry.ts        # 10 道化学题
    biology.ts          # 10 道生物题
    english.ts          # 10 道英语写作题
    geography.ts        # 10 道地理题
    history.ts          # 10 道历史题
  components/           # SettingsPanel / SubjectTabs / QuestionCard / ScreenshotPanel / ResultPanel / SummaryBar / ScoreRing
  App.tsx               # 状态（localStorage 持久化）、科目切换、截图识别、一键批改并发池、导出 JSON
  lib/grading.spec.ts   # 判分链路单元测试（mock fetch）
  lib/vision.spec.ts    # 识图链路单元测试（mock fetch：端点归一化、CORS 回退、响应解析）
  data/subjects.spec.ts # 题库完整性测试（题量/id/档位/演示作答/无选择题/得分点）
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
   Vercel 静态部署用根目录的 `vercel.json` rewrite 实现同样的转发（`/api/typesafe/:path*` → `https://api.typesafe.ai/:path*`），否则线上请求这个路径会 404。
3. 如果你有开了 CORS 的自建网关（例如 `https://your-gateway.com/v1`），把 Base URL 填成绝对地址也可以。

界面上如果填的是绝对地址 `https://api.typesafe.ai`，设置面板会直接给出「改用内置代理」的一键按钮；
请求失败时错误信息里也会附带上面这段处理建议。

### 识图模型同理：`/api/vision-proxy` 动态代理

识图网关是使用者在页面上现填的，没法写进 `vite.config.ts` 的静态 target，所以做成了一个
「目标地址放在请求头」的动态代理：

```
POST /api/vision-proxy/chat/completions
Authorization: Bearer <识图 Key>
x-vision-target: https://api.openai.com/v1
```

上游就是 `https://api.openai.com/v1/chat/completions`。前端在 dev / preview 里默认**先代理、后直连**，
直连被 CORS 拦时会自动换成代理重试；生产部署时可用 Nginx 提供同样语义的路径：

```nginx
location /api/vision-proxy/ {
    proxy_pass https://your-vision-gateway/;   # 按需改写 / 或用 mini-proxy 读取 x-vision-target
    proxy_set_header x-vision-target $http_x_vision_target;
    proxy_set_header authorization  $http_authorization;
}
```

也可以直接在设置里把 Base URL 填成你自己开了 CORS 的反向代理地址（例如 `/api/openai/v1`）。

Vercel 部署时，项目已内置带白名单的 Serverless Function `api/vision-proxy/chat/completions.ts`
（文件名即路由，非 Next 项目的 `/api` 不支持 `[...path]` 动态段，写成固定路径才生效）：

- **默认开放**（`VISION_ALLOWED_HOSTS` 未设置 = `*`）：放行任意公网 https 地址，多人各自网关不同
  时开箱即用。会拦截 localhost / 内网段 / link-local / 云元数据（`169.254.169.254` 等），但域名
  解析层面的 DNS rebinding 无法完全防住；函数相当于公共转发服务，建议只对可信人群开放，并留意
  Vercel 函数用量。
- 要收紧就设 `VISION_ALLOWED_HOSTS=域名列表`（逗号分隔，支持 `*.example.com`），不在列表内会返回
  403；列表里加 `*` 可再放开。注意 `*` 不代表允许 http：http 网关还要单独写域名，写成
  `*,http-gw.example.com`。
- 默认只允许 https；只支持 http 的网关必须显式写进 `VISION_ALLOWED_HOSTS` 才放行（http 会明文
  传输 Key、图片与转写文字，公网上不要这么用）。函数不跟随重定向，避免变成公开的 SSRF 跳板。
  注意 Vercel 函数跑在云端，局域网 / 内网 http 地址（如 `192.168.x.x`）它访问不到，需要公网可达
  的 https 地址。
- 函数侧限制请求体 4 MB、`maxDuration` 60 s（Hobby 上限，见 `vercel.json`）。截图过多或模型
  特别慢时会超限，可减少截图数量 / 压缩图片，或自己用 Nginx 反代绕过这些平台限制（前端会自动
  先直连、失败再走代理，两条路都行）。

## 常见问题

- **Key 会泄露吗？** Jev 与识图两套 Key 都不会上传到任何服务器，只存在 `localStorage`；
  但演示页请勿在公共电脑上长期保留。
- **429 / 5xx**：两个客户端都自带指数退避重试，失败会在题目卡片上提示原因；超时会提示换更快的模型或压缩图片。
- **为什么不让模型直接输出自然语言评语？** 评分要能被代码消费：类型化答案 + 概率 + 置信度，
  比解析一段文字更可靠，也更容易把阈值、权重、复核规则写死在代码里。
- **为什么截图不直接给 Jev？** Jev 判分吃的是文本 state；先转写再判分，输入可编辑、可复核，
  也避免手写体直接干扰评分点判定。转写失败的截图可人工修正文字后再批改。
- **成本**：Jev 一次请求内含多个问题（并行评估），每个科目 10 道题大约 10 次请求；
  识图按张计费，一次识别 1~4 张图，结果面板与导出 JSON 里都能看到 token 数。
- **多人用、每人识图网关不同怎么办？** 默认已放行任意公网 https 网关，无需配置（见上文）；
  如果网关自己支持 CORS（预检返回 `Access-Control-Allow-Origin`），浏览器会直连成功、根本不走
  代理；也可以用 `VISION_ALLOWED_HOSTS` 收紧范围，或让每人自建开了 CORS 的反代填进 Base URL。

## 参考

- Jev 文档：<https://docs.typesafe.ai/>
- Quick start：<https://docs.typesafe.ai/introduction/quickstart>
- 三种原语：<https://docs.typesafe.ai/primitives>（Choice / Score / Noul）
- API Key 与 Playground：<https://console.typesafe.ai/>

## 友情链接

- [LINUX DO](https://linux.do/)