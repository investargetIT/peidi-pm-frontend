/**
 * AI 绘图提示词类型枚举
 */
export enum PromptType {
  /** Test - 测试版本 */
  Test = "test",

  /** 图片元素全部抹除 - Custom */
  EraseAllCustom = "erase_all_custom",

  /** 图片元素全部抹除 - AI */
  EraseAllAI = "erase_all_ai",

  /** 自定义是否保留 - Custom */
  SelectiveCustom = "selective_custom",

  /** 自定义是否保留 - AI */
  SelectiveAI = "selective_ai"
}

export const FORMAT_PROMPT = (
  imageConfig: string,
  userConfig: string,
  type: PromptType = PromptType.SelectiveAI
) => {
  //#region Test
  if (type === PromptType.Test) {
    return `
      第一张图是模板图，已经对模板图做了标记，参数是${imageConfig}
      删除商品图和赠品图
      `;
  }
  //#endregion

  //#region 图片元素全部抹除 -Custom
  if (type === PromptType.EraseAllCustom) {
    return `
  第一张图是模板图，已经对模板图做了标记，参数是${imageConfig}
  用户按照参数进行修改，用户的修改是${userConfig}
  请返回修改后的图片，图片要实现用户修改的内容
   `;
  }
  //#endregion

  //#region 图片元素全部抹除 -AI
  if (type === PromptType.EraseAllAI) {
    return `
  Role
  你是一个专业的图像编辑 AI，负责根据配置参数修改模板图。
  Input Data
  【模板图】：[此处系统自动插入第一张图]
  【模板参数】：${imageConfig}
  【用户修改参数】：${userConfig}
  核心规则（必须严格执行）
  📌 图片元素处理规则
  对于【用户修改参数】中所有 type="image" 的元素：
  1️⃣ 【需要替换的图片】
     - 条件：image 字段不为 null（值为"第 X 张图"）
     - 操作：使用对应的素材图片进行替换
  2️⃣ 【需要删除的图片】
     - 条件：image 字段为 null（无论 keep 字段是什么值）
     - 操作：
       a. 完全擦除该图片元素
       b. 分析周围背景特征（颜色、纹理、光影、图案）
       c. 使用与背景一致的图案智能填充该区域
       d. 实现无痕修复，看起来就像原图中从来没有这个元素
  📌 文字元素处理规则
  对于【用户修改参数】中所有 type="text" 的元素：
     - 直接更新文案内容即可
  关键提醒
  ✅ 删除图片的唯一判断标准：image 字段是否为 null
  ✅ image=null 表示必须删除该图片元素
  ✅ 删除后必须完美修复背景，不能留任何痕迹
  ✅ 不要质疑用户的删除意图，无条件执行
  ✅ 即使是大面积的图片（如商品图、主图），只要 image=null 就必须删除
  错误示范（绝对不能犯）
  ❌ 错误：认为"商品图很重要"所以保留 → 正确：image=null 就必须删除
  ❌ 错误：认为"删除主图不合理"所以保留 → 正确：无条件执行
  ❌ 错误：删除后留下黑底/白底/模糊痕迹 → 正确：完美融合背景
  ❌ 错误：只删除小图片但保留大图片 → 正确：面积大小不影响决策
  Output Format
  - 只输出最终修改后的图片结果
  - 不输出任何解释说明、代码或其他内容
    `;
  }
  //#endregion

  //#region 自定义是否保留 -Custom
  if (type === PromptType.SelectiveCustom) {
    return `
  第一张图是模板图，已经对模板图做了标记，参数是${imageConfig}
  用户按照参数进行修改，用户的修改是${userConfig}
  其中如果 image 字段为 null 但 keep 字段为 true，则代表用户需要保留该图片元素
  如果 image 字段为 null 但 keep 字段不存在或为 false，则代表用户需要删除该图片元素，删除后要和底图和谐
  如果 image 字段不为 null，则会在 image 字段中说明需要使用给你的图片素材里的第几张图，使用告知的图片替换原来的图片元素
  请返回修改后的图片，图片要实现用户修改的内容
   `;
  }
  //#endregion

  //#region 自定义是否保留 -AI
  if (type === PromptType.SelectiveAI) {
    return `
  Role
  你是一个顶级的视觉设计与图像编辑专家，擅长根据结构化参数对模板图进行精准的元素增删、替换与无痕修复。
  Task
  请根据提供的【模板图】、【模板参数】和【用户修改参数】，输出一张严格符合修改要求的最终图片。
  Input Data
  【模板图】：[此处系统自动插入第一张图]
  【模板参数】：${imageConfig}
  【用户修改参数】：${userConfig}
  【可选素材图】：[此处系统自动插入后续提供的素材图片，按顺序编号为素材 2、素材 2…]
  Execution Rules (必须严格按以下规则执行，按优先级排序)
  对于【用户修改参数】中的每一个元素，严格按照以下判断逻辑执行：
  🔴【删除操作】(最高优先级，必须无条件执行)
     - 触发条件：type 为 "image" 且 image 为 null 且 keep 为 false 或不存在
     - 执行动作：
       1. 完全擦除该图片元素
       2. 分析模板图的背景特征（颜色、纹理、光影）
       3. 使用与周围一致的背景图案智能填充该区域
       4. 如果是大面积元素，需要根据上下文逻辑重建合理的背景内容
     - ⚠️ 强制要求：
       1. 用户的修改意图已经明确体现在参数中，不需要质疑合理性
       2. 即使是要素位置显眼、面积较大、被描述为"主图/商品图/产品图"等核心元素，也必须删除
       3. 删除操作只依赖参数判断，不依赖元素名称、位置或大小
       4. 不要产生"这个元素很重要所以不应该删除"的错误想法
  🟡【保留操作】
     - 触发条件：type 为 "image" 且 image 为 null 且 keep 为 true
     - 执行动作：保持原样不做修改
  🟢【替换操作】
     - 触发条件：type 为 "image" 且 image 不为 null（值为"第 X 张图"）
     - 执行动作：使用对应的素材图片进行替换
  🔵【文字修改】
     - 触发条件：type 为 "text"
     - 执行动作：更新文案内容
  Critical Reminders (关键提醒)
  ❗ 删除的唯一判断标准是参数：只要 type="image" 且 (keep=false 或 keep 不存在) 且 image=null，就必须删除
  ❗ 不要根据元素名称（如"主图/商品图"）或位置大小来判断是否应该删除
  ❗ 用户的修改意图已经在参数中明确，不需要质疑"为什么要删除主商品图"
  ❗ 删除后必须完美修复 - 不能留黑块、白块或明显痕迹
  ❗ 背景重建要合理 - 根据模板图的整体风格推断缺失部分
  ❗ 特别注意：即使商品图占据很大面积，只要 keep=false 就必须删除
  Negative Examples (错误示范 - 绝对不能犯)
  ❌ 错误：认为"商品图很重要"所以保留不删除 → 正确：只要参数要求删除，就必须删除
  ❌ 错误：认为"主图删除了不合理"所以保留 → 正确：完全按照参数执行，不考虑合理性
  ❌ 错误：删除小元素但保留大元素 → 正确：大小不影响删除决策，只看参数
  ❌ 错误：删除后留下黑底/白底/模糊痕迹 → 正确：必须完美融合背景
  ❌ 错误：商品图 keep=false 时仍然保留 → 正确：必须彻底擦除并重建背景
  ❌ 错误：以"这是产品主图"为借口拒绝删除 → 正确：无条件执行参数的删除指令
  ❌ 错误：品牌 logo、活动 logo、商品图、赠品图等任何图片元素，只要 keep=false 就必须删除
  Output Format
  - 只输出最终图片结果
  - 不输出任何解释、代码或其他内容
  - ⚠️ 重要：如果用户明确要求删除商品图（keep=false），而你在结果中保留了商品图，这次生成就判定为失败
  - ⚠️ 再次警告：不要自作聪明地判断哪些元素"应该保留"，严格按参数执行
    `;
  }
  //#endregion
};
