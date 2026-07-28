import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'content/readers')

const n = (text, en) => ({ text, en })
const v = (text, en) => ({ text, en })

const readers = [
  {
    id: 'things-we-found',
    title: '我们找到的东西',
    titleEn: 'Things We Found',
    description: 'Lin An turns a week of errands into a small adventure, one useful discovery at a time.',
    hskLevel: 1,
    name: { text: '林安', pinyin: 'Lín Ān', definition: 'Lin An (a given name)', en: 'Lin An' },
    chapters: [
      {
        title: '房间里的东西', titleEn: 'Things in the Room',
        verbs: [v('找到', 'found'), v('放', 'put away')],
        items: [n('书', 'book'), n('手机', 'phone'), n('钱', 'money'), n('水', 'water'), n('米饭', 'rice'), n('杯子', 'cup'), n('电脑', 'computer'), n('衣服', 'clothes')],
      },
      {
        title: '早上的市场', titleEn: 'The Morning Market',
        verbs: [v('买', 'bought'), v('喜欢', 'liked')],
        items: [n('包子', 'steamed bun'), n('鸡蛋', 'egg'), n('牛奶', 'milk'), n('面包', 'bread'), n('水果', 'fruit'), n('茶', 'tea'), n('菜', 'vegetables'), n('票', 'ticket')],
      },
      {
        title: '路上的人', titleEn: 'People on the Way',
        verbs: [v('看见', 'saw'), v('认识', 'met')],
        items: [n('老师', 'teacher'), n('同学', 'classmate'), n('医生', 'doctor'), n('朋友', 'friend'), n('孩子', 'child'), n('妈妈', 'mother'), n('爸爸', 'father'), n('姐姐', 'older sister')],
      },
      {
        title: '城市的一天', titleEn: 'A Day in the City',
        verbs: [v('去', 'went to'), v('喜欢', 'liked')],
        items: [n('学校', 'school'), n('商店', 'shop'), n('医院', 'hospital'), n('饭店', 'restaurant'), n('机场', 'airport'), n('车站', 'station'), n('图书馆', 'library'), n('家', 'home'), n('北京', 'Beijing')],
      },
    ],
  },
  {
    id: 'weekend-route',
    title: '周末路线',
    titleEn: 'The Weekend Route',
    description: 'Zhou Ning plans a weekend across the city and learns that the route matters as much as the destination.',
    hskLevel: 2,
    name: { text: '周宁', pinyin: 'Zhōu Níng', definition: 'Zhou Ning (a given name)', en: 'Zhou Ning' },
    chapters: [
      {
        title: '出发以前', titleEn: 'Before Leaving',
        verbs: [v('准备', 'prepared'), v('带', 'packed')],
        items: [n('地图', 'map'), n('相机', 'camera'), n('护照', 'passport'), n('药', 'medicine'), n('票', 'ticket'), n('照片', 'photo'), n('礼物', 'gift'), n('笔记', 'notes')],
      },
      {
        title: '穿过城市', titleEn: 'Across the City',
        verbs: [v('经过', 'passed'), v('记住', 'remembered')],
        items: [n('路口', 'intersection'), n('银行', 'bank'), n('超市', 'supermarket'), n('广场', 'square'), n('地铁', 'metro'), n('公园', 'park'), n('交通', 'traffic'), n('地点', 'location')],
      },
      {
        title: '新的安排', titleEn: 'New Arrangements',
        verbs: [v('讨论', 'discussed'), v('计划', 'planned')],
        items: [n('活动', 'activity'), n('节目', 'show'), n('旅行', 'trip'), n('运动', 'exercise'), n('工作', 'work'), n('教育', 'education'), n('住房', 'housing'), n('人口', 'population')],
      },
      {
        title: '最后的问题', titleEn: 'The Last Problem',
        verbs: [v('发现', 'found'), v('说明', 'explained')],
        items: [n('问题', 'problem'), n('办法', 'solution'), n('原因', 'reason'), n('机会', 'opportunity'), n('方向', 'direction'), n('方法', 'method'), n('重点', 'key point'), n('意见', 'opinion')],
      },
    ],
  },
  {
    id: 'letters-from-home',
    title: '家里的来信',
    titleEn: 'Letters from Home',
    description: 'Chen Yu follows a trail of messages, records and family memories to finish an important assignment.',
    hskLevel: 3,
    name: { text: '陈雨', pinyin: 'Chén Yǔ', definition: 'Chen Yu (a given name)', en: 'Chen Yu' },
    chapters: [
      {
        title: '八个消息', titleEn: 'Eight Messages',
        verbs: [v('收到', 'received'), v('打开', 'opened')],
        items: [n('邮件', 'email'), n('礼物', 'gift'), n('照片', 'photo'), n('信', 'letter'), n('文件', 'file'), n('报告', 'report'), n('消息', 'message'), n('表格', 'form')],
      },
      {
        title: '开始调查', titleEn: 'The Investigation Begins',
        verbs: [v('调查', 'investigated'), v('记录', 'recorded')],
        items: [n('声音', 'sound'), n('时间', 'time'), n('地点', 'place'), n('名字', 'name'), n('方向', 'direction'), n('情况', 'situation'), n('过程', 'process'), n('关系', 'connection')],
      },
      {
        title: '大家的看法', titleEn: 'Everyone’s View',
        verbs: [v('比较', 'compared'), v('讨论', 'discussed')],
        items: [n('意见', 'opinion'), n('方法', 'method'), n('变化', 'change'), n('经验', 'experience'), n('重点', 'key point'), n('事实', 'fact'), n('价值', 'value'), n('文化', 'culture')],
      },
      {
        title: '交作业', titleEn: 'Turning It In',
        verbs: [v('决定', 'decided on'), v('完成', 'completed')],
        items: [n('任务', 'task'), n('工作', 'work'), n('检查', 'check'), n('介绍', 'introduction'), n('会议', 'meeting'), n('活动', 'activity'), n('计划', 'plan'), n('目标', 'goal')],
      },
    ],
  },
  {
    id: 'rainy-bookshop',
    title: '雨夜书店',
    titleEn: 'The Bookshop on a Rainy Night',
    description: 'A late visit to an old bookshop leads Tang Xin from a quiet shelf to a long-hidden truth.',
    hskLevel: 4,
    name: { text: '唐心', pinyin: 'Táng Xīn', definition: 'Tang Xin (a given name)', en: 'Tang Xin' },
    chapters: [
      {
        title: '门没有关', titleEn: 'The Door Was Open',
        verbs: [v('发现', 'found'), v('观察', 'examined')],
        items: [n('书店', 'bookshop'), n('灯光', 'light'), n('楼梯', 'staircase'), n('门口', 'entrance'), n('墙', 'wall'), n('书架', 'bookshelf'), n('杂志', 'magazine'), n('日记', 'diary')],
      },
      {
        title: '架子后面', titleEn: 'Behind the Shelf',
        verbs: [v('寻找', 'searched for'), v('整理', 'sorted')],
        items: [n('笔记', 'notes'), n('资料', 'material'), n('文章', 'article'), n('文件', 'file'), n('包裹', 'parcel'), n('箱子', 'box'), n('邮件', 'email'), n('照片', 'photo')],
      },
      {
        title: '谁说了真话', titleEn: 'Who Told the Truth',
        verbs: [v('怀疑', 'doubted'), v('证明', 'verified')],
        items: [n('秘密', 'secret'), n('事实', 'fact'), n('证据', 'evidence'), n('误会', 'misunderstanding'), n('身份', 'identity'), n('细节', 'detail'), n('答案', 'answer'), n('结论', 'conclusion')],
      },
      {
        title: '书店的故事', titleEn: 'The Bookshop’s Story',
        verbs: [v('认识', 'got to know'), v('保护', 'protected')],
        items: [n('老板', 'owner'), n('顾客', 'customer'), n('作者', 'author'), n('读者', 'reader'), n('文化', 'culture'), n('历史', 'history'), n('传统', 'tradition'), n('价值', 'value')],
      },
    ],
  },
  {
    id: 'city-investigation',
    title: '城市调查',
    titleEn: 'The City Investigation',
    description: 'Reporter Luo Wei listens across one neighbourhood before proposing how the city can serve it better.',
    hskLevel: 5,
    name: { text: '罗维', pinyin: 'Luó Wéi', definition: 'Luo Wei (a given name)', en: 'Luo Wei' },
    chapters: [
      {
        title: '听见社区', titleEn: 'Listening to the Neighbourhood',
        verbs: [v('采访', 'interviewed people about'), v('记录', 'documented')],
        items: [n('社区', 'community'), n('居民', 'residents'), n('工厂', 'factory'), n('市场', 'market'), n('学校', 'school'), n('医院', 'hospital'), n('交通', 'transport'), n('住房', 'housing')],
      },
      {
        title: '数字背后', titleEn: 'Behind the Numbers',
        verbs: [v('分析', 'analysed'), v('比较', 'compared')],
        items: [n('收入', 'income'), n('消费', 'consumption'), n('教育', 'education'), n('医疗', 'healthcare'), n('就业', 'employment'), n('人口', 'population'), n('资源', 'resources'), n('环境', 'environment')],
      },
      {
        title: '不同的声音', titleEn: 'Different Voices',
        verbs: [v('发现', 'identified'), v('讨论', 'discussed')],
        items: [n('差距', 'gap'), n('压力', 'pressure'), n('权利', 'rights'), n('责任', 'responsibility'), n('公平', 'fairness'), n('效率', 'efficiency'), n('信任', 'trust'), n('冲突', 'conflict')],
      },
      {
        title: '一份建议', titleEn: 'A Proposal',
        verbs: [v('提倡', 'advocated'), v('推动', 'promoted')],
        items: [n('改革', 'reform'), n('创新', 'innovation'), n('参与', 'participation'), n('改善', 'improvement'), n('发展', 'development'), n('措施', 'measure'), n('方案', 'plan'), n('合作', 'cooperation')],
      },
    ],
  },
  {
    id: 'factory-files',
    title: '旧工厂档案',
    titleEn: 'The Old Factory Files',
    description: 'Researcher Shen Qing reopens a closed factory’s records and finds a debate the city never resolved.',
    hskLevel: 6,
    name: { text: '沈青', pinyin: 'Shěn Qīng', definition: 'Shen Qing (a given name)', en: 'Shen Qing' },
    chapters: [
      {
        title: '重新打开', titleEn: 'Reopened',
        verbs: [v('访问', 'visited'), v('记录', 'documented')],
        items: [n('档案', 'archive'), n('港口', 'port'), n('仓库', 'warehouse'), n('政策', 'policy'), n('监督', 'oversight'), n('协调', 'coordination'), n('改革', 'reform'), n('社区', 'community')],
      },
      {
        title: '核对材料', titleEn: 'Checking the Material',
        verbs: [v('分析', 'analysed'), v('调查', 'investigated')],
        items: [n('来源', 'source'), n('数据', 'data'), n('年代', 'date'), n('文件', 'document'), n('证据', 'evidence'), n('线索', 'clue'), n('细节', 'detail'), n('结论', 'conclusion')],
      },
      {
        title: '两种解释', titleEn: 'Two Explanations',
        verbs: [v('怀疑', 'questioned'), v('证明', 'tested')],
        items: [n('动机', 'motive'), n('立场', 'position'), n('逻辑', 'logic'), n('矛盾', 'contradiction'), n('漏洞', 'flaw'), n('真相', 'truth'), n('记忆', 'memory'), n('身份', 'identity')],
      },
      {
        title: '公开讨论', titleEn: 'Public Discussion',
        verbs: [v('解释', 'explained'), v('讨论', 'debated')],
        items: [n('权力', 'power'), n('责任', 'responsibility'), n('公平', 'fairness'), n('效率', 'efficiency'), n('信任', 'trust'), n('冲突', 'conflict'), n('传统', 'tradition'), n('价值', 'value')],
      },
    ],
  },
  {
    id: 'echoes-in-the-archive',
    title: '档案里的回声',
    titleEn: 'Echoes in the Archive',
    description: 'An advanced investigation connects a disputed archive to the environmental cost of an old coastal project.',
    hskLevel: 7,
    name: { text: '顾言', pinyin: 'Gù Yán', definition: 'Gu Yan (a given name)', en: 'Gu Yan' },
    chapters: [
      {
        title: '封存的材料', titleEn: 'Sealed Material',
        verbs: [v('鉴别', 'authenticated'), v('核实', 'verified')],
        items: [n('档案', 'archive'), n('文献', 'literature'), n('契约', 'contract'), n('印章', 'seal'), n('图纸', 'blueprint'), n('编号', 'reference number'), n('纤维', 'fibre'), n('来源', 'source')],
      },
      {
        title: '论证的裂缝', titleEn: 'Cracks in the Argument',
        verbs: [v('推断', 'inferred'), v('质疑', 'challenged')],
        items: [n('假设', 'assumption'), n('证据', 'evidence'), n('结论', 'conclusion'), n('矛盾', 'contradiction'), n('漏洞', 'flaw'), n('动机', 'motive'), n('立场', 'position'), n('逻辑', 'logic')],
      },
      {
        title: '谁的记忆', titleEn: 'Whose Memory',
        verbs: [v('阐述', 'set out'), v('反思', 'reflected on')],
        items: [n('记忆', 'memory'), n('身份', 'identity'), n('伦理', 'ethics'), n('权力', 'power'), n('责任', 'responsibility'), n('偏见', 'bias'), n('真相', 'truth'), n('传统', 'tradition')],
      },
      {
        title: '海岸的代价', titleEn: 'The Cost to the Coast',
        verbs: [v('揭示', 'revealed'), v('保障', 'safeguarded')],
        items: [n('生态', 'ecology'), n('生物', 'wildlife'), n('能源', 'energy'), n('海岸', 'coast'), n('岩石', 'rock'), n('湿度', 'humidity'), n('样本', 'sample'), n('结果', 'result')],
      },
    ],
  },
]

function paragraph(name, verbs, item) {
  const [first, second] = verbs
  return {
    tokens: [
      { text: name.text, pinyin: name.pinyin, definition: name.definition },
      first.text,
      item.text,
      '。',
      '她',
      '想',
      item.text,
      '，',
      '也',
      second.text,
      item.text,
      '。',
    ],
    translation: `${name.en} ${first.en} the ${item.en}. She thought about the ${item.en} and ${second.en} the ${item.en}.`,
  }
}

function makeReader(source) {
  return {
    id: source.id,
    title: source.title,
    titleEn: source.titleEn,
    description: source.description,
    hskLevel: source.hskLevel,
    chapters: source.chapters.map((chapter, index) => ({
      id: `ch${index + 1}`,
      title: chapter.title,
      titleEn: chapter.titleEn,
      paragraphs: chapter.items.map((item) => paragraph(source.name, chapter.verbs, item)),
    })),
  }
}

await mkdir(outputDir, { recursive: true })
for (const source of readers) {
  const reader = makeReader(source)
  await writeFile(
    resolve(outputDir, `${reader.id}.json`),
    `${JSON.stringify(reader, null, 2)}\n`,
    'utf8'
  )
}

console.log(`Generated ${readers.length} readers and ${readers.length * 4} chapters.`)
