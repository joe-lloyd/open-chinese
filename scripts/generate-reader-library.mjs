import { readFileSync } from 'node:fs'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(root, 'content/readers')
const wordLevels = new Map()
for (let level = 1; level <= 9; level += 1) {
  const entries = JSON.parse(
    readFileSync(resolve(root, `packages/build-tools/hsk${level}.json`), 'utf8')
  )
  for (const entry of entries) wordLevels.set(entry.simplified, level)
}
const knownWords = new Set(wordLevels.keys())
const longestKnownWord = Math.max(...[...knownWords].map((word) => [...word].length))

const people = new Map([
  ['林安', ['Lín Ān', 'Lin An (a given name)']],
  ['方雨', ['Fāng Yǔ', 'Fang Yu (a given name)']],
  ['陈舟', ['Chén Zhōu', 'Chen Zhou (a given name)']],
  ['吴可', ['Wú Kě', 'Wu Ke (a given name)']],
  ['周宁', ['Zhōu Níng', 'Zhou Ning (a given name)']],
  ['唐心', ['Táng Xīn', 'Tang Xin (a given name)']],
  ['罗维', ['Luó Wéi', 'Luo Wei (a given name)']],
  ['沈青', ['Shěn Qīng', 'Shen Qing (a given name)']],
  ['顾言', ['Gù Yán', 'Gu Yan (a given name)']],
  ['许川', ['Xǔ Chuān', 'Xu Chuan (a given name)']],
  ['叶真', ['Yè Zhēn', 'Ye Zhen (a given name)']],
  ['宋远', ['Sòng Yuǎn', 'Song Yuan (a given name)']],
  ['陆文', ['Lù Wén', 'Lu Wen (a given name)']],
  ['白露', ['Bái Lù', 'Bai Lu (a given name)']],
  ['高原', ['Gāo Yuán', 'Gao Yuan (a given name)']],
  ['程星', ['Chéng Xīng', 'Cheng Xing (a given name)']],
  ['江月', ['Jiāng Yuè', 'Jiang Yue (a given name)']],
  ['苏平', ['Sū Píng', 'Su Ping (a given name)']],
  ['韩秋', ['Hán Qiū', 'Han Qiu (a given name)']],
  ['郑禾', ['Zhèng Hé', 'Zheng He (a given name)']],
])

const punctuation = /([。，！？；：“”《》、…])/g

function segmentUnknown(token) {
  if (knownWords.has(token) || punctuation.test(token)) return [token]
  punctuation.lastIndex = 0

  const characters = [...token]
  const best = Array(characters.length + 1).fill(null)
  best[characters.length] = []
  for (let start = characters.length - 1; start >= 0; start -= 1) {
    for (
      let width = Math.min(longestKnownWord, characters.length - start);
      width >= 1;
      width -= 1
    ) {
      const candidate = characters.slice(start, start + width).join('')
      if (!knownWords.has(candidate) || best[start + width] === null) continue
      best[start] = [candidate, ...best[start + width]]
      break
    }
  }
  return best[0] ?? [token]
}

function tokenize(text) {
  return text
    .trim()
    .split(/\s+/)
    .flatMap((part) => part.split(punctuation).filter(Boolean))
    .flatMap((token) => {
      const person = people.get(token)
      return person
        ? [{ text: token, pinyin: person[0], definition: person[1] }]
        : segmentUnknown(token)
    })
}

const p = (text, translation) => ({ tokens: tokenize(text), translation })
const chapter = (title, titleEn, focusWords, paragraphs) => ({
  title,
  titleEn,
  focusWords,
  paragraphs,
})
const focusStopWords = new Set([
  '一个', '一些', '这个', '那个', '我们', '他们', '她们', '自己', '什么', '没有',
  '因为', '所以', '但是', '如果', '已经', '还是', '可以', '可能', '应该', '开始',
  '最后', '今天', '现在', '时候', '一起', '这里', '那里',
])

function pedagogicalFocus(entry, level) {
  const occurrences = new Map()
  for (const paragraph of entry.paragraphs) {
    for (const token of paragraph.tokens) {
      if (typeof token !== 'string' || !wordLevels.has(token)) continue
      occurrences.set(token, (occurrences.get(token) ?? 0) + 1)
    }
  }

  const usable = (word) =>
    occurrences.has(word) &&
    wordLevels.get(word) <= level &&
    !focusStopWords.has(word) &&
    [...word].length > 1

  const selected = entry.focusWords.filter(usable)
  const candidates = [...occurrences.keys()]
    .filter((word) => usable(word) && !selected.includes(word))
    .sort(
      (left, right) =>
        wordLevels.get(right) - wordLevels.get(left) ||
        [...right].length - [...left].length ||
        occurrences.get(right) - occurrences.get(left)
    )

  return [...selected, ...candidates].slice(0, 3)
}

const story = (
  hskLevel,
  id,
  title,
  titleEn,
  description,
  goal,
  conflict,
  resolution,
  chapters
) => {
  return {
    id,
    title,
    titleEn,
    description,
    hskLevel,
    goal,
    conflict,
    resolution,
    chapters: chapters.map((entry, index) => ({
      id: `ch${index + 1}`,
      ...entry,
      focusWords: pedagogicalFocus(entry, hskLevel),
    })),
  }
}

const stories = [
  // HSK 1
  story(
    1,
    'last-baozi',
    '最后一个包子',
    'The Last Baozi',
    'Lin An must choose what to do with the only lunch he has left.',
    'Lin An wants to save his last baozi for lunch.',
    'A new classmate is hungry and has no food.',
    'They share the baozi and begin a friendship.',
    [
      chapter('两个包子', 'Two Baozi', ['包子', '买', '吃'], [
        p('早上 ， 林安 买 两 个 包子 。 他 吃 一个 包子 ， 放 一个 包子 在 书包 里 。', 'In the morning, Lin An buys two baozi. He eats one and puts the other in his schoolbag.'),
        p('中午 快 到 了 。 林安 想 吃 书包 里 的 包子 。 他 看 了 看 时间 ， 又 看 了 看 包子 。', 'Noon is near. Lin An wants to eat the baozi in his schoolbag. He looks at the time, then at the baozi.'),
      ]),
      chapter('新同学', 'The New Classmate', ['同学', '饿', '没有'], [
        p('新 同学 方雨 坐 在 林安 旁边 。 大家 都 吃饭 ， 方雨 没有 米饭 ， 也 没有 面包 。', 'The new student, Fang Yu, sits beside Lin An. Everyone is eating, but Fang Yu has no rice and no bread.'),
        p('林安 问 ： “ 你 饿 吗 ？ ” 方雨 点头 。 他 很 饿 ， 可 他 说 ： “ 我 没事儿 。 ”', 'Lin An asks, “Are you hungry?” Fang Yu nods. He is very hungry, but says, “I’m fine.”'),
      ]),
      chapter('一人一半', 'Half Each', ['一半', '给', '朋友'], [
        p('林安 把 一半 包子 给 方雨 。 方雨 不 要 ， 林安 说 ： “ 一人 一半 ， 我们 一起 吃 。 ”', 'Lin An gives Fang Yu half the baozi. Fang Yu refuses, but Lin An says, “Half each. We’ll eat together.”'),
        p('他们 一人 吃 一半 ， 也 一起 喝 水 。 方雨 笑 了 ， 林安 也 笑 了 。 今天 ， 他们 是 朋友 了 。', 'They each eat half and share some water. Fang Yu smiles, and Lin An smiles too. Today, they have become friends.'),
      ]),
    ]
  ),
  story(
    1,
    'ticket-at-the-station',
    '车站的票',
    'The Ticket at the Station',
    'Fang Yu loses her train ticket just as it is time to leave.',
    'Fang Yu wants to take the train to see her grandmother.',
    'Her ticket disappears at the busy station.',
    'She retraces her steps and finds who picked it up.',
    [
      chapter('要上车了', 'Time to Board', ['车站', '车票', '时间'], [
        p('方雨 和 妈妈 来到 车站 。 火车 在 前边 ， 上车 的 时间 马上 要 到 了 。', 'Fang Yu and her mother arrive at the station. The train is ahead, and boarding time is almost here.'),
        p('妈妈 拿 车票 ， 方雨 也 找 车票 。 她 找 书包 ， 找 衣服 ， 找 手机 ， 没有 车票 。', 'Her mother takes out her ticket, and Fang Yu looks for hers. She searches her schoolbag, clothes, and phone, but there is no ticket.'),
      ]),
      chapter('走过的路', 'The Way Back', ['回来', '看到', '路上'], [
        p('方雨 从 门口 走 回来 。 她 看 地上 ， 也 看 路上 的 人 。 妈妈 在 后边 等 她 。', 'Fang Yu walks back from the entrance. She looks at the ground and at the people along the way. Her mother waits behind her.'),
        p('她 看到 一个 老人 拿 着 一张 票 。 老人 也 看到 方雨 ， 问 ： “ 你 在 找 这个 吗 ？ ”', 'She sees an elderly person holding a ticket. The person sees Fang Yu and asks, “Are you looking for this?”'),
      ]),
      chapter('名字在这里', 'The Name Is Here', ['名字', '找到', '谢谢'], [
        p('方雨 看 票 上 的 名字 。 那 是 她 的 名字 ！ 她 找到 车票 了 。', 'Fang Yu checks the name on the ticket. It is her name! She has found her ticket.'),
        p('方雨 和 妈妈 一起 说 ： “ 谢谢 ！ ” 老人 笑 着 说 ： “ 快 上车 吧 。 ” 她们 最后 上 了 火车 。', 'Fang Yu and her mother say, “Thank you!” The person smiles and says, “Get on the train quickly.” In the end, they make it aboard.'),
      ]),
    ]
  ),
  story(
    1,
    'cat-at-school',
    '学校里的猫',
    'The Cat at School',
    'A cat follows Chen Zhou into school, but nobody knows where it lives.',
    'Chen Zhou wants to help a cat get home.',
    'The cat cannot tell anyone its name or address.',
    'A familiar song on the phone leads its owner to the school.',
    [
      chapter('跟我上学', 'Following Me to School', ['猫', '学校', '跟'], [
        p('陈舟 走路 去 学校 。 一只 小 猫 从 家 门口 跟 他 ， 一直 跟 到 学校 。', 'Chen Zhou walks to school. A small cat follows him from his doorway all the way to school.'),
        p('陈舟 进 教学楼 ， 猫 也 想 进 。 老师 说 ： “ 猫 不 上课 。 我们 要 帮 它 回家 。 ”', 'Chen Zhou enters the school building, and the cat wants to enter too. The teacher says, “Cats don’t attend class. We need to help it go home.”'),
      ]),
      chapter('它的家在哪儿', 'Where Is Its Home?', ['问', '知道', '家'], [
        p('同学 问 ： “ 猫 的 家 在 哪儿 ？ ” 陈舟 不 知道 ， 老师 也 不 知道 。', 'The students ask, “Where is the cat’s home?” Chen Zhou does not know, and neither does the teacher.'),
        p('老师 和 同学 到 门口 。 猫 看 东边 ， 看 西边 ， 不 走 。 陈舟 拿 手机 打电话 ， 猫 听 手机 。', 'The teacher and students go to the entrance. The cat looks east and west but does not leave. Chen Zhou takes out his phone to call, and the cat listens.'),
      ]),
      chapter('一首歌', 'A Song', ['听见', '电话', '回家'], [
        p('手机 里 有 一首 歌 。 猫 听见 歌 ， 马上 叫 了 起来 。 门外 一个 女孩儿 也 听见 这首 歌 。', 'There is a song on the phone. When the cat hears it, it immediately cries out. A girl outside hears the same song.'),
        p('女孩儿 跑 进来 ， 说 ： “ 这是 我 的 猫 ！ ” 她 告诉 陈舟 她 的 名字 和 电话 。 猫 高兴 地 跟 她 回家 了 。', 'The girl runs in and says, “This is my cat!” She gives Chen Zhou her name and phone number. The cat happily follows her home.'),
      ]),
    ]
  ),
  story(
    1,
    'quiet-birthday',
    '安静的生日',
    'The Quiet Birthday',
    'Wu Ke thinks everyone has forgotten his birthday.',
    'Wu Ke hopes his family remembers his birthday.',
    'The whole day passes without anyone saying a word about it.',
    'A quiet home turns into a small, heartfelt celebration.',
    [
      chapter('没有人说', 'Nobody Says It', ['生日', '今天', '说'], [
        p('今天 是 吴可 的 生日 。 早上 ， 爸爸 没有 说 “ 生日 快乐 ” ， 妈妈 也 没有 说 。', 'Today is Wu Ke’s birthday. In the morning, neither his father nor his mother says “Happy birthday.”'),
        p('在 学校 ， 朋友们 说 天气 ， 说 考试 ， 说 电影 。 没有 人 说 ： “ 生日 快乐 。 ”', 'At school, his friends talk about the weather, tests, and films. Nobody says, “Happy birthday.”'),
      ]),
      chapter('一个人回家', 'Going Home Alone', ['回家', '不高兴', '朋友'], [
        p('放学 了 ， 吴可 一个人 回家 。 朋友 问 他 去 哪儿 ， 他 说 ： “ 我 回家 。 ”', 'After school, Wu Ke goes home alone. A friend asks where he is going, and he says, “I’m going home.”'),
        p('路上 有 很多 人 ， 吴可 还是 不 高兴 。 他 想 ： “ 朋友 忘 了 ， 家人 也 忘 了 。 ”', 'There are many people on the road, but Wu Ke is still unhappy. He thinks, “My friends forgot, and my family forgot too.”'),
      ]),
      chapter('门后的声音', 'Voices Behind the Door', ['打开', '一起', '快乐'], [
        p('家里 很 安静 。 吴可 打开 门 ， 房间 里 没有 人 。 他 再 开 灯 。', 'Home is very quiet. Wu Ke opens the door, and the room seems empty. Then he turns on the light.'),
        p('爸爸 、 妈妈 和 朋友们 一起 出来 ： “ 生日 快乐 ！ ” 桌子 上 有 面条儿 、 水果 和 茶 。 吴可 真的 快乐 了 。', 'His parents and friends come out together: “Happy birthday!” There are noodles, fruit, and tea on the table. Wu Ke is truly happy.'),
      ]),
    ]
  ),
  story(
    1,
    'light-in-the-bookshop',
    '书店里的灯',
    'The Light in the Bookshop',
    'A light left on in a closed bookshop makes Lin An stop on his way home.',
    'Lin An wants to make sure the old bookseller is safe.',
    'The door is open, but nobody answers.',
    'He finds the sleeping owner and prevents a cold, wet night.',
    [
      chapter('晚上还有灯', 'A Light Still On', ['晚上', '书店', '灯'], [
        p('晚上 ， 林安 从 学校 回家 。 商店 都 关 了 ， 一个 小 书店 还有 灯 。', 'In the evening, Lin An walks home from school. All the shops are closed, but one small bookshop still has a light on.'),
        p('外边 下雨 了 。 书店 的 门 没有 关 ， 雨水 要 进 房间 。 林安 站 在 门口 ， 看 着 那个 灯 。', 'It begins to rain outside. The bookshop door is not closed, and rain is about to enter. Lin An stands at the entrance, looking at the light.'),
      ]),
      chapter('谁在里面', 'Who Is Inside?', ['进去', '老人', '听见'], [
        p('林安 说 ： “ 有 人 吗 ？ ” 没有 回答 。 他 慢慢 进去 ， 听见 楼上 有 声音 。', 'Lin An calls, “Is anyone there?” There is no answer. He slowly goes inside and hears a sound upstairs.'),
        p('楼上 ， 一个 老人 在 桌子 旁边 睡觉 。 窗户 没有 关 ， 风 很 冷 。 林安 叫 了 老人 两次 。', 'Upstairs, an elderly man is asleep beside a table. The window is open, and the wind is cold. Lin An calls him twice.'),
      ]),
      chapter('一起关门', 'Closing Up Together', ['关上', '帮助', '谢谢'], [
        p('老人 起来 了 。 他 和 林安 一起 关上 窗户 ， 关上 门 ， 也 关 了 楼上 的 灯 。', 'The man wakes. He and Lin An close the window and the door, then turn off the upstairs light.'),
        p('老人 说 ： “ 谢谢 你 的 帮助 。 ” 他 送 林安 一本 好看 的 书 。 林安 拿 着 书 ， 高兴 地 回家 了 。', 'The man says, “Thank you for your help.” He gives Lin An a beautiful book. Lin An carries it home happily.'),
      ]),
    ]
  ),

  // HSK 2
  story(
    2,
    'weekend-route',
    '没有终点的路线',
    'The Route with No Destination',
    'Zhou Ning plans the perfect trip, until a lost child changes the destination.',
    'Zhou Ning wants to photograph the lake before sunset.',
    'She meets a child who cannot find his family.',
    'Helping him becomes the most important part of her trip.',
    [
      chapter('最短的路', 'The Shortest Route', ['计划', '地图', '出发'], [
        p('周宁 计划 周末 去 湖边 。 她 在 地图 上 画 了 最短 的 路线 ， 也 准备 了 相机 和 食物 。', 'Zhou Ning plans to visit the lakeside at the weekend. She marks the shortest route on her map and packs a camera and food.'),
        p('早晨 天气 很 好 ， 周宁 按 计划 出发 。 她 相信 下午 以前 一定 能 到 ， 所以 一路 没有 停 。', 'The weather is good that morning, and Zhou Ning leaves according to plan. She believes she will arrive before afternoon, so she does not stop.'),
      ]),
      chapter('路边的孩子', 'The Child by the Road', ['孩子', '找不到', '帮助'], [
        p('在 一个 路口 ， 周宁 看见 一个 孩子 在 哭 。 孩子 找 不 到 妈妈 ， 也 不 知道 酒店 的 名字 。', 'At an intersection, Zhou Ning sees a child crying. He cannot find his mother and does not know the hotel’s name.'),
        p('周宁 看 了 看 时间 。 如果 帮助 孩子 ， 她 可能 看 不 到 湖 了 。 孩子 又 喊 了一声 “ 妈妈 ” 。', 'Zhou Ning checks the time. If she helps the child, she may miss the lake. The child calls “Mum” once more.'),
      ]),
      chapter('新的终点', 'A New Destination', ['警察', '终于', '照片'], [
        p('周宁 带 孩子 去 找 警察 。 警察 通过 酒店 的 照片 找到 地址 ， 孩子 终于 见到 了 妈妈 。', 'Zhou Ning takes the child to the police. Using a photograph of the hotel, they find the address, and the child is finally reunited with his mother.'),
        p('太阳 已经 下山 ， 周宁 没有 湖 的 照片 。 孩子 的 妈妈 给 她 拍 了一张 照片 。 周宁 觉得 ， 这 才 是 今天 最好 的 风景 。', 'The sun has already set, and Zhou Ning has no lake photograph. The child’s mother takes a picture of her. Zhou Ning feels this is the best view of the day.'),
      ]),
    ]
  ),
  story(
    2,
    'borrowed-bicycle',
    '借来的自行车',
    'The Borrowed Bicycle',
    'A borrowed bicycle is damaged before an important race.',
    'Chen Zhou wants to keep a promise and return the bicycle on time.',
    'The bicycle breaks, and he is afraid to tell its owner.',
    'He chooses honesty and repairs it together with his friend.',
    [
      chapter('明天以前', 'Before Tomorrow', ['借', '自行车', '答应'], [
        p('陈舟 向 朋友 吴可 借 了一辆 自行车 。 他 答应 明天 以前 还车 ， 因为 吴可 要 参加 学校 的 比赛 。', 'Chen Zhou borrows a bicycle from his friend Wu Ke. He promises to return it before tomorrow because Wu Ke has a school race.'),
        p('陈舟 骑车 去 给 奶奶 送 药 。 回来 的 路上 开始 下雪 ， 道路 越来越 难走 。', 'Chen Zhou cycles to deliver medicine to his grandmother. On the way back, snow begins to fall and the road grows harder to ride.'),
      ]),
      chapter('坏了', 'Broken', ['坏', '害怕', '告诉'], [
        p('自行车 忽然 倒 在 地上 ， 前边 的 车轮 坏 了 。 陈舟 很 害怕 ， 不 知道 怎么 告诉 吴可 。', 'The bicycle suddenly falls, and its front wheel breaks. Chen Zhou is frightened and does not know how to tell Wu Ke.'),
        p('他 想 买 一个 新 车轮 ， 可是 商店 已经 关门 。 他 也 想 什么 都 不 说 ， 但是 比赛 就 在 明天 。', 'He wants to buy a new wheel, but the shop is closed. He also considers saying nothing, but the race is tomorrow.'),
      ]),
      chapter('一起修', 'Repairing It Together', ['诚实', '修理', '相信'], [
        p('陈舟 最后 给 吴可 打电话 ， 诚实 地 说明 了 事情 。 吴可 安静 了 一会儿 ， 然后 带 工具 来 了 。', 'Chen Zhou finally phones Wu Ke and honestly explains what happened. Wu Ke is quiet for a moment, then brings tools.'),
        p('两个人 一起 修理 自行车 ， 半夜 才 完成 。 第二天 ， 吴可 顺利 参加 比赛 。 他 说 ： “ 我 生气 ， 但 我 还是 相信 你 。 ”', 'They repair the bicycle together and finish at midnight. The next day, Wu Ke competes successfully. He says, “I was angry, but I still trust you.”'),
      ]),
    ]
  ),
  story(
    2,
    'wrong-train',
    '坐错的火车',
    'The Wrong Train',
    'Two friends board the wrong train while travelling to a music competition.',
    'Fang Yu and Lin An want to reach a competition on time.',
    'Their train carries them away from the city.',
    'They ask for help, adapt their plan, and still perform.',
    [
      chapter('一样的站台', 'The Same Platform', ['火车', '比赛', '站台'], [
        p('方雨 和 林安 要 坐 火车 去 参加 音乐 比赛 。 车站 有 两辆 火车 ， 它们 在 同一个 站台 。', 'Fang Yu and Lin An are taking a train to a music competition. Two trains wait at the same platform.'),
        p('他们 听见 “ 快 上车 ” ， 就 跑 上 最近 的 火车 。 车 开 了 ， 两个人 开心 地 练习 歌曲 。', 'They hear “Board quickly” and run onto the nearest train. It departs, and they happily practise their song.'),
      ]),
      chapter('城市在后面', 'The City Behind Them', ['方向', '错误', '着急'], [
        p('半个 小时 后 ， 方雨 发现 窗户 外面 是 大海 ， 不是 城市 。 林安 看 地图 ， 发现 方向 完全 错误 。', 'Half an hour later, Fang Yu sees the sea outside instead of the city. Lin An checks the map and discovers they are going entirely the wrong way.'),
        p('他们 很 着急 ， 也 有点儿 生气 。 但是 生气 没有 用 ， 他们 必须 找到 回去 的 办法 。', 'They are anxious and a little angry. But anger is no use; they must find a way back.'),
      ]),
      chapter('车上的节目', 'A Performance on the Train', ['乘客', '表演', '机会'], [
        p('一位 旅客 帮助 他们 给 音乐 老师 打电话 。 下 一 站 有 回去 的 火车 ， 但是 他们 会 晚 到 一个 小时 。', 'A passenger helps them phone the music teacher. There is a train back at the next station, but they will arrive an hour late.'),
        p('等 火车 的 时候 ， 旅客 请 他们 唱歌 。 方雨 和 林安 唱 了 比赛 的 歌 。 比赛 已经 完 了 ， 但是 车上 的 人 都 喜欢 他们 ， 老师 也 给 他们 下次 机会 。', 'While they wait, the passengers ask them to sing. Fang Yu and Lin An perform their competition song. The contest is over, but everyone aboard enjoys it, and the teacher gives them another chance.'),
      ]),
    ]
  ),
  story(
    2,
    'photo-for-grandmother',
    '给奶奶的照片',
    'A Photograph for Grandmother',
    'A family photograph seems impossible when everyone is too busy to meet.',
    'Wu Ke wants to give his grandmother a complete family photograph.',
    'Each family member can come at a different time.',
    'He turns separate moments into one honest gift.',
    [
      chapter('一个愿望', 'One Wish', ['奶奶', '照片', '全家'], [
        p('奶奶 的 生日 快 到 了 。 她 不 要 礼物 ， 只 想 要 一张 全家 在 一起 的 照片 。', 'Grandmother’s birthday is near. She does not want a present, only a photograph of the whole family together.'),
        p('吴可 答应 给 她 拍 照片 。 他 给 全家 发 信息 ， 请 大家 星期天 来 公园 。', 'Wu Ke promises to take it. He messages the entire family and asks them to come to the park on Sunday.'),
      ]),
      chapter('总有人很忙', 'Someone Is Always Busy', ['工作', '时间', '不同'], [
        p('爸爸 上午 工作 ， 姐姐 下午 考试 ， 哥哥 晚上 才 回来 。 每个人 有空 的 时间 都 不同 。', 'Father works in the morning, his sister has an afternoon exam, and his brother returns only in the evening. Everyone is free at a different time.'),
        p('吴可 改 了 三次 计划 ， 还是 没有 合适 的 时间 。 他 看着 空空 的 相机 ， 心情 很 难过 。', 'Wu Ke changes the plan three times, but there is still no suitable time. He looks at the empty camera and feels sad.'),
      ]),
      chapter('同一个地方', 'The Same Place', ['办法', '位置', '礼物'], [
        p('吴可 想到 一个 办法 ： 每个人 在 同一个 位置 拍 一张 照片 ， 也 对 奶奶 说 一句话 。', 'Wu Ke thinks of a solution: each person takes a picture in the same spot and says one sentence to Grandmother.'),
        p('生日 那天 ， 奶奶 看到 所有 照片 和 大家 的 话 。 她 说 ： “ 大家 没有 同时 来 ， 可 每个人 的 爱 都 来 了 。 ” 这是 她 最 喜欢 的 礼物 。', 'On her birthday, Grandmother sees all the photographs and messages. She says, “You did not all come at once, but everyone’s love arrived.” It is her favourite gift.'),
      ]),
    ]
  ),
  story(
    2,
    'night-market-wallet',
    '夜市的钱包',
    'The Wallet at the Night Market',
    'A wallet full of money tests two friends at a noisy night market.',
    'Two friends want to find the wallet’s owner.',
    'They need the money themselves and disagree about what to do.',
    'A small clue leads them to the owner and repairs their trust.',
    [
      chapter('桌子下面', 'Under the Table', ['钱包', '市场', '发现'], [
        p('周宁 和 方雨 在 夜里 的 市场 吃 面条儿 。 方雨 在 桌子 下面 发现 一个 黑色 钱包 。', 'Zhou Ning and Fang Yu eat noodles at the night market. Fang Yu finds a black wallet under the table.'),
        p('钱包 里 有 很多 钱 ， 还有 一张 没有 名字 的 照片 。 他们 等 了 很久 ， 没有人 回来 找 。', 'The wallet contains a lot of money and an unnamed photograph. They wait a long time, but nobody returns.'),
      ]),
      chapter('两种想法', 'Two Ideas', ['意见', '需要', '争论'], [
        p('方雨 认为 应该 交给 警察 。 周宁 的 自行车 坏 了 ， 他 正好 需要 钱 ， 所以 他 有 不同 的 意见 。', 'Fang Yu thinks they should hand it to the police. Zhou Ning’s bicycle is broken and he needs money, so he has a different opinion.'),
        p('两个人 第一次 大声 争论 。 方雨 说 ： “ 需要 钱 不是 拿 别人 的 钱 的 原因 。 ” 周宁 没有 回答 。', 'For the first time, they argue loudly. Fang Yu says, “Needing money is not a reason to take someone else’s.” Zhou Ning does not answer.'),
      ]),
      chapter('照片里的店', 'The Shop in the Photograph', ['照片', '主人', '归还'], [
        p('周宁 再 看 照片 ， 发现 后边 有 一家 红色 小店 。 他们 按 照片 找到 店 ， 店里 的 老人 正在 找 钱包 。', 'Zhou Ning checks the photograph again and notices a small red shop behind the people. They find it, where an elderly owner is searching for the wallet.'),
        p('周宁 亲自 归还 钱包 ， 也 向 方雨 说 对不起 。 老人 没有 给 钱 ， 只 帮 他 免费 修好 自行车 。 周宁 觉得 这样 更 好 。', 'Zhou Ning returns the wallet himself and apologises to Fang Yu. The owner gives no money, but repairs his bicycle for free. Zhou Ning feels this is better.'),
      ]),
    ]
  ),

  // HSK 3
  story(
    3,
    'letters-from-home',
    '没有寄出的信',
    'The Letter Never Sent',
    'Chen Zhou finds an old letter that changes how he understands his father.',
    'Chen Zhou wants to know why his father left his hometown.',
    'The family has avoided the subject for years.',
    'An unsent letter opens an honest conversation.',
    [
      chapter('旧箱子', 'The Old Box', ['整理', '信', '过去'], [
        p('陈舟 帮 父亲 整理 老家 的 房间 。 在 一个 旧 箱子 里 ， 他 发现 一封 二十年 前 写 的 信 。', 'Chen Zhou helps his father clear a room in the old family home. In an old box, he finds a letter written twenty years earlier.'),
        p('信 上 有 父亲 的 名字 ， 却 没有 邮票 。 陈舟 想 打开 ， 又 觉得 那 是 父亲 不 愿意 说 的 过去 。', 'The letter bears his father’s name but has no stamp. Chen Zhou wants to open it, yet senses it belongs to a past his father does not wish to discuss.'),
      ]),
      chapter('两种记忆', 'Two Memories', ['父亲', '离开', '原因'], [
        p('陈舟 一直 以为 父亲 为了 工作 离开 故乡 。 奶奶 却 说 ， 当年 父亲 和 家人 发生 了 严重 的 争论 。', 'Chen Zhou has always believed his father left for work. Grandmother says his father had a serious argument with the family that year.'),
        p('陈舟 问 父亲 真正 的 原因 。 父亲 生气 地 说 ： “ 过去 的 事情 没有 必要 再 提 。 ” 房间 又 安静 了 。', 'Chen Zhou asks for the real reason. His father angrily says, “There is no need to raise the past again.” The room falls silent.'),
      ]),
      chapter('一起打开', 'Opening It Together', ['诚实', '理解', '回信'], [
        p('晚上 ， 父亲 主动 拿来 那封 信 。 他 请 陈舟 一起 打开 。 原来 ， 那 是 他 向 奶奶 道歉 的 信 ， 只是 一直 不 敢 寄出 。', 'That evening, his father brings the letter himself and asks Chen Zhou to open it with him. It is an apology to Grandmother that he never dared to send.'),
        p('陈舟 没有 批评 父亲 。 他 说 ： “ 现在 写 回信 也 不 晚 。 ” 父亲 终于 笑 了 。 两个人 开始 写 一封 新 信 。', 'Chen Zhou does not criticise him. He says, “It is not too late to write a reply now.” His father finally smiles, and they begin a new letter.'),
      ]),
    ]
  ),
  story(
    3,
    'empty-seat',
    '一直空着的座位',
    'The Empty Seat',
    'A student’s empty seat reveals a problem the class had chosen not to see.',
    'Fang Yu wants her class team to be complete for a contest.',
    'A quiet teammate stops coming to school after being mocked.',
    'The class takes responsibility and changes how it works together.',
    [
      chapter('少了一个人', 'One Person Missing', ['比赛', '座位', '成员'], [
        p('班级 要 参加 一场 科学 比赛 ， 每个 成员 都 有 任务 。 可是 连续 三天 ， 吴可 的 座位 一直 空着 。', 'The class is entering a science contest, and every member has a task. But for three days, Wu Ke’s seat remains empty.'),
        p('有人 说 他 不 认真 ， 有人 建议 换 一个 成员 。 方雨 没有 同意 ， 因为 吴可 设计 了 最 重要 的 部分 。', 'Some say he is careless; others suggest replacing him. Fang Yu disagrees because Wu Ke designed the most important part.'),
      ]),
      chapter('没有说出的原因', 'The Unspoken Reason', ['批评', '玩笑', '压力'], [
        p('方雨 去 吴可 家 看 他 。 吴可 说 ， 大家 常常 因为 他 说话 慢 开玩笑 ， 还 在 网上 批评 他 的 设计 。', 'Fang Yu visits Wu Ke at home. He says people often mock his slow speech and criticise his design online.'),
        p('他 不是 不 想 比赛 ， 而是 害怕 再 回 教室 。 方雨 第一次 明白 ， 大家 认为 好玩儿 的 话 给 了 他 很大 压力 。', 'It is not that he does not want to compete; he is afraid to return to class. Fang Yu realises that words others found funny placed great pressure on him.'),
      ]),
      chapter('座位没有换', 'The Seat Stays', ['道歉', '合作', '改变'], [
        p('第二天 ， 全班 公开 向 吴可 道歉 。 他们 没有 要求 他 马上 回来 ， 只是 按照 他 的 意见 改进 设计 。', 'The next day, the entire class publicly apologises. They do not demand his immediate return; they simply improve the design according to his ideas.'),
        p('比赛 那天 ， 吴可 自己 走进 教室 。 他的 座位 没有 换 ， 团队 的 合作 方式 却 改变 了 。 他们 最后 一起 完成 任务 。', 'On competition day, Wu Ke walks into the classroom by himself. His seat has not changed, but the team’s way of working has. Together, they complete the task.'),
      ]),
    ]
  ),
  story(
    3,
    'school-radio',
    '停播前一分钟',
    'One Minute Before Broadcast',
    'A student reporter must decide whether an exciting rumour belongs on the school radio.',
    'Lin An wants his first radio report to attract attention.',
    'His best story is based on an unconfirmed rumour.',
    'He stops the broadcast and reports only what he can prove.',
    [
      chapter('最好的消息', 'The Best News', ['记者', '消息', '广播'], [
        p('林安 成为 学校 广播 的 新 记者 。 第一天 ， 他 收到 一个 消息 ： 一位 有名 歌手 可能 来 学校 表演 。', 'Lin An becomes a new reporter for the school radio. On his first day, he receives news that a famous singer may perform at the school.'),
        p('这个 消息 一定 会 吸引 观众 。 林安 很 快 写好 广播 内容 ， 准备 中午 播出 。', 'The news is sure to attract listeners. Lin An quickly writes the broadcast and prepares to air it at noon.'),
      ]),
      chapter('没有来源', 'No Source', ['调查', '来源', '证明'], [
        p('方雨 问 消息 的 来源 。 林安 只 知道 同学 从 另一个 同学 那里 听说 ， 没有人 能 证明 。', 'Fang Yu asks for the source. Lin An only knows that one student heard it from another; nobody can confirm it.'),
        p('林安 调查 了 电视台 、 学校 网站 和 老师 ， 都 没有 发现 正式 通知 。 离 广播 只 剩 一分钟 。', 'Lin An checks the television station, school website, and teachers, but finds no official announcement. Only one minute remains before broadcast.'),
      ]),
      chapter('真正的报道', 'The Real Report', ['停止', '事实', '负责'], [
        p('音乐 已经 开始 ， 林安 却 按 下 停止 。 他 对 听众 说 ： “ 我们 收到 一个 消息 ， 但 目前 不能 确定 它 是 事实 。 ”', 'The music has begun, but Lin An presses stop. He tells listeners, “We received a report, but at present we cannot confirm it as fact.”'),
        p('歌手 最后 没有 来 。 林安 的 报道 不 精彩 ， 却 很 负责 。 老师 说 ： “ 记者 的 价值 不 是 最 快 ， 是 真实 。 ”', 'The singer never comes. Lin An’s report is not exciting, but it is responsible. His teacher says, “A reporter’s value is not being fastest; it is being truthful.”'),
      ]),
    ]
  ),
  story(
    3,
    'missing-key',
    '不见的钥匙',
    'The Missing Key',
    'A missing office key makes every member of a volunteer team suspect the others.',
    'A volunteer group needs to open its room for a community event.',
    'The key is gone, and blame begins to divide the team.',
    'Careful observation reveals an ordinary mistake.',
    [
      chapter('门打不开', 'The Door Will Not Open', ['钥匙', '活动', '门'], [
        p('社区 活动 就要 开始 ， 志愿者 却 打 不 开 房间 的 门 。 放 在 办公室 的 钥匙 不见了 。', 'A community event is about to begin, but the volunteers cannot open the room. The key kept in the office has vanished.'),
        p('房间 里 有 活动 需要 的 食物 、 音乐 和 礼物 。 如果 一小时 内 找 不 到 钥匙 ， 大家 只能 取消 活动 。', 'Inside are the food, music, and gifts needed for the event. If they cannot find the key within an hour, they must cancel.'),
      ]),
      chapter('互相怀疑', 'Suspecting One Another', ['怀疑', '责任', '证据'], [
        p('有人 怀疑 最后 离开 的 方雨 ， 有人 认为 负责 钥匙 的 林安 应该 承担 责任 。 两个人 都 感到 不公平 。', 'Some suspect Fang Yu, who left last; others think Lin An, who was responsible for the key, should take the blame. Both feel unfairly treated.'),
        p('争论 越来越 大 ， 却 没有 任何 证据 。 方雨 要求 大家 停止 讨论 ， 重新 观察 办公室 的 每个 地方 。', 'The argument grows, but there is no evidence. Fang Yu asks everyone to stop debating and inspect every part of the office again.'),
      ]),
      chapter('在门的另一边', 'On the Other Side of the Door', ['发现', '误会', '解决'], [
        p('林安 从 窗户 看到 钥匙 还 在 房间 里面 的 桌子 上 。 原来 昨天 有人 从 里面 关门 ， 从 另一个 出口 走 了 。', 'Through the window, Lin An sees the key still lying on a table inside. Someone locked the room from within yesterday and left by another exit.'),
        p('大家 请 房东 带来 第二 把 钥匙 ， 问题 解决 了 。 活动 晚 了 半 小时 才 开始 ， 他们 也 学会 没有 证据 时 不 互相 怀疑 。', 'They ask the landlord to bring a second key, solving the problem. The event starts half an hour late, and they learn not to suspect one another without evidence.'),
      ]),
    ]
  ),
  story(
    3,
    'winter-final',
    '雪地里的决赛',
    'The Final in the Snow',
    'A football captain must choose between winning and protecting an injured opponent.',
    'Chen Zhou wants his team to win the winter final.',
    'The opposing goalkeeper is hurt while the winning goal is open.',
    'Chen Zhou stops play and discovers what kind of captain he wants to be.',
    [
      chapter('只差一场', 'One Match Away', ['决赛', '队长', '胜利'], [
        p('陈舟 的 足球队 第一次 进入 决赛 。 他 是 队长 ， 全队 都 相信 他 能 带来 胜利 。', 'Chen Zhou’s football team reaches the final for the first time. He is captain, and the whole team believes he can lead them to victory.'),
        p('比赛 那天 突然 下雪 ， 地面 很 滑 。 教练 提醒 大家 注意 安全 ， 陈舟 心里 却 只有 金牌 。', 'Snow falls suddenly on match day, making the ground slippery. The coach reminds everyone to be safe, but Chen Zhou can think only of the gold medal.'),
      ]),
      chapter('没有人的球门', 'The Empty Goal', ['受伤', '机会', '停止'], [
        p('最后 一分钟 ， 对方 守门 的 学生 摔倒 受伤 。 球门 前 没有 人 ， 球 正好 在 陈舟 脚下 。', 'In the last minute, the opposing goalkeeper falls and is hurt. The goal is empty, and the ball is at Chen Zhou’s feet.'),
        p('这是 最好 的 机会 。 观众 大声 喊 他 向前 ， 陈舟 却 看到 那个 学生 不能 站 起来 。 他 停止 了 。', 'It is the perfect chance. The crowd shouts for him to advance, but Chen Zhou sees that the student cannot stand. He stops.'),
      ]),
      chapter('另一种胜利', 'Another Kind of Victory', ['帮助', '尊重', '结果'], [
        p('陈舟 把 球 踢 出去 ， 跑去 帮助 受伤 的 学生 。 比赛 重新 开始 后 ， 对方 进球 ， 陈舟 的 队 输 了 。', 'Chen Zhou kicks the ball out and runs to help the injured player. When play resumes, the opponents score, and his team loses.'),
        p('队员 开始 很 难过 ， 后来 对方 全队 来 感谢 他 ， 也 说 很 尊重 他 。 教练 说 ： “ 比赛 输 了 ， 你的 选择 是 胜利 。 ”', 'His teammates are upset at first. Later, the opposing team thanks him and says they respect him. The coach says, “The match was lost; your choice was a victory.”'),
      ]),
    ]
  ),

  // HSK 4
  story(
    4,
    'rainy-bookshop',
    '雨夜书店',
    'The Bookshop on a Rainy Night',
    'A diary hidden behind a shelf may be the only way to save an old bookshop.',
    'Tang Xin wants to help the owner keep his bookshop open.',
    'The owner refuses to use a private diary for publicity.',
    'They protect the writer’s privacy and let the neighbourhood tell its own story.',
    [
      chapter('最后一个雨夜', 'The Last Rainy Night', ['书店', '倒闭', '顾客'], [
        p('唐心 在 大雨 中 走进 一家 老 书店 。 老板 正在 把 书 放进 箱子 ， 因为 书店 下个月 就要 倒闭 。', 'Tang Xin enters an old bookshop during heavy rain. The owner is boxing books because the shop will close next month.'),
        p('这里 以前 有 很多 顾客 ， 如今 大家 都 在 网上 买书 。 唐心 是 当晚 唯一 的 顾客 ， 她 决定 帮助 老板 。', 'The shop once had many customers; now everyone buys books online. Tang Xin is the only customer that evening, and she decides to help.'),
      ]),
      chapter('书架后面的日记', 'The Diary Behind the Shelf', ['日记', '秘密', '保护'], [
        p('整理 书架 时 ， 唐心 发现 一本 日记 。 日记 记录 一位 著名 作家 年轻 时 在 这里 工作 的 秘密 。', 'While sorting a shelf, Tang Xin finds a diary. It records the secret that a famous writer worked there when young.'),
        p('这个 秘密 可以 吸引 媒体 和 顾客 。 老板 却 要求 唐心 保护 日记 ， 因为 作家 从来 没有 同意 公开 。', 'The secret could attract media attention and customers. But the owner asks Tang Xin to protect the diary because the writer never agreed to make it public.'),
      ]),
      chapter('不公开的故事', 'The Story They Do Not Publish', ['居民', '记忆', '重新'], [
        p('唐心 没有 公开 日记 。 她 采访 附近 居民 ， 请 每个人 分享 自己 和 书店 的 记忆 。', 'Tang Xin does not publish the diary. She interviews nearby residents and asks each to share a memory of the shop.'),
        p('这些 真实 记忆 在 网络 上 受到 关注 ， 居民 也 重新 来到 书店 。 老板 保住 了 秘密 ， 书店 也 有 了 新 的 未来 。', 'These real memories gain attention online, and residents return. The owner keeps the secret, and the bookshop gains a new future.'),
      ]),
    ]
  ),
  story(
    4,
    'last-bus',
    '最后一班车',
    'The Last Bus',
    'A bus driver turns back through a storm to return a passenger’s medicine.',
    'The driver wants to finish his final route safely and on time.',
    'A forgotten bag contains medicine needed that night.',
    'Passengers accept the delay and help locate the owner.',
    [
      chapter('准时回家', 'Home on Time', ['司机', '末班车', '准时'], [
        p('宋远 是 晚上 末班车 的 司机 。 当天 是 女儿 的 生日 ， 他 答应 下班 后 准时 回家 。', 'Song Yuan drives the last bus of the night. It is his daughter’s birthday, and he has promised to return home on time.'),
        p('外面 下 着 暴雨 ， 道路 严重 堵车 。 宋远 一边 注意 安全 ， 一边 看 时间 ， 希望 不要 再 发生 意外 。', 'Heavy rain falls and traffic is badly blocked. Song Yuan watches the road and the time, hoping nothing else goes wrong.'),
      ]),
      chapter('座位上的袋子', 'The Bag on the Seat', ['袋子', '药物', '返回'], [
        p('最后 一位 乘客 下车 后 ， 宋远 在 座位 上 发现 一个 袋子 。 袋子 里 有 医院 的 药物 和 一个 地址 。', 'After the final passenger leaves, Song Yuan finds a bag on a seat. It contains hospital medicine and an address.'),
        p('地址 在 六 公里 外 ， 返回 会 让 他 错过 女儿 的 生日 。 可 药物 上 写 着 ： “ 今天 晚上 使用 。 ”', 'The address is six kilometres back, and returning will make him miss his daughter’s birthday. But the medicine says, “Use tonight.”'),
      ]),
      chapter('一起晚到', 'Late Together', ['乘客', '帮助', '理解'], [
        p('车上 还有 三位 乘客 。 他们 听说 情况 后 ， 都 同意 返回 ， 还 帮助 宋远 找到 正确 的 楼房 。', 'Three passengers remain aboard. After hearing what happened, they agree to turn back and help Song Yuan find the right building.'),
        p('病人 得到 了 药物 。 宋远 回家 时 已经 半夜 ， 女儿 还 在 等 他 。 她 说 ： “ 我 理解 ， 今天 你 帮助 了 一个 家庭 。 ”', 'The patient receives the medicine. It is midnight when Song Yuan arrives home, but his daughter is waiting. She says, “I understand. Today you helped a family.”'),
      ]),
    ]
  ),
  story(
    4,
    'balcony-garden',
    '阳台上的花园',
    'The Balcony Garden',
    'Two neighbours fight over a leaking garden before discovering a shared problem.',
    'Bai Lu wants to keep the garden on her balcony.',
    'Water from the plants damages the neighbour’s wall.',
    'They redesign the garden to collect rainwater for the whole building.',
    [
      chapter('楼上的春天', 'Spring Upstairs', ['阳台', '植物', '邻居'], [
        p('白露 在 阳台 上 种 了 很多 植物 。 春天 一到 ， 鲜花 吸引 了 整栋楼 的 邻居 。', 'Bai Lu grows many plants on her balcony. When spring arrives, the flowers attract neighbours from the whole building.'),
        p('楼下 的 邻居 却 不 高兴 。 他 的 墙 变得 潮湿 ， 认为 是 白露 每天 给 植物 浇水 导致 的 。', 'The downstairs neighbour is unhappy. His wall has grown damp, and he believes Bai Lu’s daily watering is the cause.'),
      ]),
      chapter('谁的责任', 'Whose Responsibility?', ['责任', '漏水', '争论'], [
        p('邻居 要求 白露 立刻 搬走 所有 植物 。 白露 不 承认 自己 有 全部 责任 ， 两个人 在 楼道 里 激烈 争论 。', 'The neighbour demands that Bai Lu remove every plant. She refuses to accept all responsibility, and they argue fiercely in the corridor.'),
        p('维修 工人 检查 后 发现 ， 阳台 的确 漏水 ， 但是 大楼 的 旧 管道 也 已经 破了 。 问题 属于 双方 。', 'A repair worker finds that the balcony does leak, but the building’s old pipe is also broken. The problem belongs to both sides.'),
      ]),
      chapter('雨水留下来', 'Keeping the Rain', ['合作', '收集', '改善'], [
        p('白露 提出 一个 方案 ： 修好 水 管 ， 在 阳台 安装 收集 雨水 的 设备 。 楼下 的 人 愿意 和 她 合作 。', 'Bai Lu proposes repairing the water pipe and installing equipment to collect rainwater on the balcony. Her downstairs neighbour agrees to cooperate.'),
        p('夏天 来 时 ， 收集 的 雨水 不但 养 植物 ， 也 可以 打扫 楼里 。 花园 保留 了 ， 两家 的 关系 也 改善 了 。', 'By summer, the collected rainwater feeds the plants and cleans the building. The garden remains, and the two households’ relationship improves.'),
      ]),
    ]
  ),
  story(
    4,
    'silent-phone',
    '没有声音的电话',
    'The Silent Phone Call',
    'A silent call leads a nurse to someone who cannot ask for help.',
    'Nurse Jiang Yue wants to identify a silent caller.',
    'Hospital rules protect patient information, and the caller cannot speak.',
    'Small background sounds reveal the caller’s location.',
    [
      chapter('三次来电', 'Three Calls', ['电话', '声音', '护士'], [
        p('护士 江月 在 医院 值班 时 ， 接到 一个 没有 声音 的 电话 。 她 问 了 三次 ， 对方 都 没有 回答 。', 'While on duty, nurse Jiang Yue receives a call with no voice. She asks three times, but the caller never answers.'),
        p('电话 很快 挂 了 ， 几分钟 后 又 打来 。 江月 听见 很 轻 的 呼吸 声 ， 怀疑 有 病人 需要 帮助 。', 'The call ends, then returns minutes later. Jiang Yue hears faint breathing and suspects a patient needs help.'),
      ]),
      chapter('背景里的线索', 'Clues in the Background', ['背景', '判断', '位置'], [
        p('江月 不能 根据 一个 号码 随便 查询 个人 资料 。 她 只能 从 电话 的 背景 声音 判断 位置 。', 'Jiang Yue cannot casually search personal data from a phone number. She must infer the location from background sounds.'),
        p('她 听到 电梯 到达 的 音乐 ， 还 听到 医院 广播 。 对方 就 在 医院 内部 ， 而且 可能 在 安静 的 楼层 。', 'She hears an elevator arrival tune and a hospital announcement. The caller is inside the hospital, probably on a quiet floor.'),
      ]),
      chapter('不能说话的人', 'The Person Who Cannot Speak', ['寻找', '发现', '及时'], [
        p('江月 请 保安 一层 一层 寻找 。 最后 ， 他们 在 地下 检查室 发现 一位 摔倒 的 老人 ， 他 暂时 不能 说话 。', 'Jiang Yue asks security to search floor by floor. They find an elderly man who has fallen in a basement examination room and cannot speak.'),
        p('老人 及时 得到 治疗 。 江月 保存 了 那段 安静 的 电话 记录 ， 因为 有时候 ， 没有 话 也 是 重要 的 消息 。', 'The man receives timely treatment. Jiang Yue keeps the record of the silent call, because sometimes the absence of words is itself an important message.'),
      ]),
    ]
  ),
  story(
    4,
    'old-photo-shop',
    '老照片店',
    'The Old Photo Shop',
    'A damaged photograph brings together two families separated by a misunderstanding.',
    'A photographer wants to restore a customer’s only family photograph.',
    'The missing half appears to belong to a family who refuses contact.',
    'Restoring the full image allows both sides to revisit the past.',
    [
      chapter('只剩一半', 'Only Half Remains', ['照片', '修复', '顾客'], [
        p('唐心 在 一家 老 照片店 工作 。 一位 顾客 带来 半张 严重 受损 的 照片 ， 请求 她 修复 。', 'Tang Xin works in an old photo shop. A customer brings half of a badly damaged photograph and asks her to restore it.'),
        p('照片 里 有 两个 年轻 女人 ， 顾客 只 认识 自己 的 母亲 。 另一半 照片 和 另一个 人 都 消失 了 。', 'The photograph shows two young women, but the customer recognises only her mother. The other half and the other woman have disappeared.'),
      ]),
      chapter('相同的背景', 'The Same Background', ['背景', '误会', '拒绝'], [
        p('唐心 在 店里 的 旧 资料 中 找到 相同 背景 的 照片 。 另一位 女人 的 家人 还 住 在 城里 。', 'Tang Xin finds a photograph with the same background in the shop’s old records. The other woman’s family still lives in the city.'),
        p('那家人 开始 拒绝 见面 。 原来 两个 家庭 因为 一次 生意 误会 ， 已经 三十年 没有 联系 。', 'At first, that family refuses to meet. The two families have had no contact for thirty years because of a business misunderstanding.'),
      ]),
      chapter('完整的画面', 'The Complete Picture', ['完整', '记忆', '原谅'], [
        p('唐心 没有 继续 要求 他们 见面 ， 只 把 修复 后 的 完整 照片 分别 寄给 两家 。 照片 后面 写着 同一个 日期 。', 'Tang Xin does not keep pressing them to meet. She simply sends the restored, complete photograph to both families. The same date is written on its back.'),
        p('几天 后 ， 两家人 一起 来到 店里 。 一张 完整 的 画面 不能 改变 过去 ， 却 让 他们 愿意 分享 记忆 ， 试着 原谅 。', 'Days later, both families come to the shop together. A complete image cannot change the past, but it makes them willing to share memories and try to forgive.'),
      ]),
    ]
  ),

  // HSK 5
  story(
    5,
    'city-investigation',
    '城市调查',
    'The City Investigation',
    'A reporter discovers that a popular redevelopment plan has erased the people it affects.',
    'Luo Wei wants to publish an important investigation.',
    'Her editor prefers dramatic numbers to complicated human stories.',
    'She proves that listening to residents changes the proposed policy.',
    [
      chapter('漂亮的数据', 'Beautiful Data', ['调查', '数据', '社区'], [
        p('记者 罗维 调查 一个 旧 社区 的 改造 计划 。 政府 提供 的 数据 显示 ， 新 建筑 会 增加 住房 ， 改善 交通 。', 'Reporter Luo Wei investigates a redevelopment plan for an old neighbourhood. Government data says new buildings will increase housing and improve transport.'),
        p('编辑 认为 这些 数据 足够 写 报道 ， 要求 罗维 当天 完成 。 罗维 却 发现 调查 中 没有 任何 居民 的 声音 。', 'Her editor thinks the numbers are enough for a story and wants it finished that day. Luo Wei notices that the investigation contains no residents’ voices.'),
      ]),
      chapter('地图上没有的人', 'People Missing from the Map', ['居民', '利益', '冲突'], [
        p('罗维 采访 居民 ， 发现 新 道路 会 经过 一个 市场 和 一所 小学 。 计划 的 公共 利益 和 居民 生活 发生 冲突 。', 'Luo Wei interviews residents and learns that the new road will cross a market and a primary school. Public benefit conflicts with residents’ lives.'),
        p('编辑 担心 复杂 内容 不够 热门 ， 删除 了 大部分 采访 。 罗维 必须 决定 接受 这个 版本 ， 还是 继续 收集 证据 。', 'Her editor worries that complexity will not be popular and removes most interviews. Luo Wei must accept this version or continue gathering evidence.'),
      ]),
      chapter('报道之后', 'After Publication', ['证据', '方案', '参与'], [
        p('罗维 用 现场 照片 、 交通 记录 和 居民 提供 的 证据 写 了 新 报道 。 她 不 反对 改造 ， 只 证明 原 方案 缺少 公众 参与 。', 'Using site photographs, traffic records, and evidence from residents, Luo Wei writes a new report. She does not oppose redevelopment; she proves the original plan lacks public participation.'),
        p('报道 推动 了一次 公开 会议 。 最后 的 方案 保留 市场 ， 也 改变 道路 方向 。 编辑 承认 ： “ 好 调查 不 只是 数据 漂亮 。 ”', 'The report prompts a public meeting. The final plan keeps the market and reroutes the road. Her editor admits, “A good investigation is not just attractive numbers.”'),
      ]),
    ]
  ),
  story(
    5,
    'mountain-clinic',
    '山里的最后一盒药',
    'The Last Box of Medicine',
    'A doctor must allocate the last medicine in an isolated mountain clinic.',
    'Doctor Bai Lu wants to care for every patient during a storm.',
    'Only one box of medicine remains for two urgent cases.',
    'The village finds a shared solution while help is delayed.',
    [
      chapter('道路中断', 'The Road Is Cut Off', ['诊所', '暴雨', '药品'], [
        p('白露 在 山区 诊所 工作 。 连续 暴雨 导致 道路 中断 ， 新 药品 至少 三天 后 才 能 送到 。', 'Bai Lu works at a mountain clinic. Continuous rain cuts the road, and new medicine cannot arrive for at least three days.'),
        p('诊所 只 剩 最后 一盒 特定 药品 。 白露 检查 数量 两次 ， 希望 不 会 同时 出现 两个 急需 的 病人 。', 'Only one box of a specific medicine remains. Bai Lu checks the count twice, hoping two urgent patients will not arrive at once.'),
      ]),
      chapter('两个家庭', 'Two Families', ['病人', '选择', '风险'], [
        p('当天 夜里 ， 两个 病人 几乎 同时 来到 。 一个 是 年老 教师 ， 一个 是 年轻 母亲 ， 两个人 的 情况 都 有 风险 。', 'That night, two patients arrive almost together: an elderly teacher and a young mother. Both face serious risks.'),
        p('家属 都 请求 使用 药品 。 白露 不能 根据 年龄 或 身份 简单 选择 ， 她 必须 评估 每种 治疗 的 可能 效果 。', 'Both families request the medicine. Bai Lu cannot choose simply by age or identity; she must assess the likely effect of each treatment.'),
      ]),
      chapter('等到天亮', 'Waiting for Daylight', ['治疗', '合作', '救援'], [
        p('白露 发现 教师 可以 使用 另一种 治疗 暂时 稳定 ， 年轻 母亲 则 没有 替代 药物 。 她 说明 原因 后 ， 教师 主动 同意 。', 'Bai Lu determines that another treatment can temporarily stabilise the teacher, while the young mother has no alternative. After she explains, the teacher agrees.'),
        p('村里 的 人 整夜 合作 ， 清理 一条 小路 ， 让 救援 人员 天亮 时 送来 药品 。 两个 病人 都 安全 了 ， 最后 一盒 药 也 没有 让 两个 家庭 成为 敌人 。', 'Villagers work through the night to clear a small path, allowing rescuers to deliver medicine at dawn. Both patients are safe, and the final box does not make enemies of two families.'),
      ]),
    ]
  ),
  story(
    5,
    'one-vote',
    '最后一票',
    'The Final Vote',
    'A young committee member holds the deciding vote on the future of a public square.',
    'Su Ping wants the neighbourhood to reach a fair decision.',
    'Both proposals benefit one group while harming another.',
    'She refuses the false choice and forces a better plan.',
    [
      chapter('两个方案', 'Two Proposals', ['投票', '广场', '方案'], [
        p('社区 要 投票 决定 广场 的 未来 。 一个 方案 建 停车场 ， 另一个 方案 建 儿童 活动 中心 。', 'The community will vote on the square’s future. One proposal builds parking; the other builds a children’s activity centre.'),
        p('年轻 代表 苏平 负责 最后 一票 。 目前 双方 得到 的 票 一样 多 ， 她 的 投票 会 直接 决定 哪个 方案 通过 。', 'Young representative Su Ping holds the final vote. The sides are tied, so her vote will decide which proposal passes.'),
      ]),
      chapter('谁被忘了', 'Who Was Forgotten?', ['利益', '老年人', '公平'], [
        p('商店 支持 停车场 ， 家长 支持 活动 中心 。 苏平 调查 后 发现 ， 两个 方案 都 忽视 了 每天 在 广场 休息 的 老年人 。', 'Shops support parking; parents support the activity centre. Su Ping discovers that both proposals ignore older people who rest in the square each day.'),
        p('两边 都 要求 她 马上 表态 ， 还 说 自己 代表 公众 利益 。 苏平 觉得 ， 在 不公平 的 选择 中 选 一边 仍然 不公平 。', 'Both sides demand her immediate support and claim to represent the public interest. Su Ping feels choosing one unfair option remains unfair.'),
      ]),
      chapter('第三个选择', 'A Third Choice', ['拒绝', '修改', '共识'], [
        p('投票 时 ， 苏平 拒绝 两个 方案 ， 提议 修改 设计 ： 地下 停车 ， 地上 保留 花园 ， 活动 中心 使用 旁边 空 房屋 。', 'At the vote, Su Ping rejects both proposals and suggests underground parking, preserving a garden above, and using a nearby empty building for activities.'),
        p('她 的 一票 没有 让 任何 一边 立刻 胜利 ， 却 让 会议 重新 开始 。 一个月 后 ， 三个 群体 终于 达成 共识 。', 'Her vote gives neither side an immediate victory, but restarts the discussion. A month later, the three groups reach consensus.'),
      ]),
    ]
  ),
  story(
    5,
    'river-race',
    '没有举行的比赛',
    'The Race That Did Not Happen',
    'A rowing team risks its championship to expose pollution in the river.',
    'The team wants to win the annual river race.',
    'They discover pollution that organisers want to hide.',
    'They refuse to compete and turn the crowd’s attention to the river.',
    [
      chapter('冠军的机会', 'A Chance at the Championship', ['比赛', '冠军', '训练'], [
        p('陈舟 的 划船 队 为 城市 河流 比赛 训练 了 一年 。 他们 从来 没有 得到 冠军 ， 今年 是 最好 的 机会 。', 'Chen Zhou’s rowing team has trained for the city river race for a year. They have never won, and this year is their best chance.'),
        p('比赛 前一天 ， 队员 在 下游 训练 时 闻到 奇怪 味道 。 水面 出现 灰色 泡沫 ， 几条 鱼 已经 死了 。', 'The day before the race, the team smells something strange downstream. Grey foam covers the water, and several fish are dead.'),
      ]),
      chapter('不能公开的结果', 'Results They Cannot Publish', ['污染', '检测', '压力'], [
        p('队员 把 水 送去 检测 ， 结果 显示 污染 超过 安全 标准 。 比赛 组织者 却 要求 他们 暂时 不 公开 。', 'They send water for testing, and results show pollution above safe limits. Race organisers ask them not to publish yet.'),
        p('组织者 说 取消 比赛 会 造成 巨大 损失 ， 还 暗示 队伍 以后 可能 不能 参赛 。 他们 一边 想 得到 冠军 ， 一边 感到 责任 的 压力 。', 'Organisers say cancelling would cause major losses and hint the team may be barred from future races. They want the championship while feeling the pressure of responsibility.'),
      ]),
      chapter('起点上的决定', 'The Decision at the Start', ['拒绝', '公开', '治理'], [
        p('比赛 开始 时 ， 陈舟 的 队 没有 出发 。 他们 在 起点 公开 检测 结果 ， 其他 队伍 也 陆续 拒绝 下水 。', 'When the race begins, Chen Zhou’s team does not start. They publish the test results at the line, and other teams gradually refuse to enter the water.'),
        p('比赛 没有 举行 ， 城市 却 开始 调查 污染 来源 和 河流 治理 。 队伍 没有 奖杯 ， 但 他们 保护 了 以后 的 每一场 比赛 。', 'The race is cancelled, but the city investigates the pollution and river management. The team wins no trophy, but protects every future race.'),
      ]),
    ]
  ),
  story(
    5,
    'midnight-kitchen',
    '午夜厨房',
    'The Midnight Kitchen',
    'A daughter discovers why her family restaurant secretly cooks after closing.',
    'Jiang Yue wants to save the struggling family restaurant.',
    'Her father gives away meals while hiding serious debt.',
    'The family turns private charity into a sustainable community table.',
    [
      chapter('关门后的灯', 'Lights After Closing', ['餐厅', '生意', '亏损'], [
        p('江月 回家 帮助 父亲 经营 餐厅 。 生意 连续 亏损 ， 她 建议 缩短 营业 时间 ， 减少 食品 成本 。', 'Jiang Yue returns home to help run her father’s restaurant. After continuing losses, she suggests shorter hours and lower food costs.'),
        p('父亲 表面 同意 ， 每天 关门 后 厨房 却 仍然 亮 着 灯 。 食物 越来越 少 ， 账上 的 支出 越来越 多 。', 'Her father agrees outwardly, yet the kitchen lights remain on after closing. Food disappears and expenses grow.'),
      ]),
      chapter('免费的晚餐', 'Free Dinners', ['免费', '隐瞒', '债务'], [
        p('一天 半夜 ， 江月 发现 父亲 给 附近 失业 人员 准备 免费 晚餐 。 他 已经 做 了 半年 ， 一直 向 家人 隐瞒 。', 'One midnight, Jiang Yue discovers her father preparing free dinners for unemployed neighbours. He has done it for six months and hidden it from the family.'),
        p('江月 尊重 父亲 的 善意 ， 却 看到 餐厅 的 债务 快 到 无法 承受 的 程度 。 如果 继续 隐瞒 ， 餐厅 和 晚餐 都 会 消失 。', 'Jiang Yue respects his kindness but sees the restaurant’s debt nearing an unbearable level. If secrecy continues, both restaurant and dinners will vanish.'),
      ]),
      chapter('多一张桌子', 'One More Table', ['社区', '捐助', '持续'], [
        p('江月 公开 了 “ 多一张桌子 ” 计划 ： 顾客 可以 多 支付 一份 饭钱 ， 社区 企业 也 可以 捐助 食品 。', 'Jiang Yue launches “One More Table”: customers may pay for an extra meal, and local businesses may donate food.'),
        p('计划 没有 完全 解决 债务 ， 却 让 帮助 可以 持续 ， 也 让 父亲 不必 一个人 承担 。 半夜 的 厨房 变成 了 社区 共同 的 厨房 。', 'The plan does not erase the debt, but makes the help sustainable and keeps her father from carrying it alone. The midnight kitchen becomes the community’s kitchen.'),
      ]),
    ]
  ),

  // HSK 6
  story(
    6,
    'factory-files',
    '旧工厂档案',
    'The Old Factory Files',
    'A researcher finds evidence that could destroy the reputation of her own mentor.',
    'Shen Qing wants to document why an old factory closed.',
    'The files implicate the professor who built her career.',
    'She publishes the evidence while giving him room to tell the truth.',
    [
      chapter('被封存的报告', 'The Sealed Report', ['工厂', '档案', '报告'], [
        p('研究员 沈青 负责 整理 一家 旧 工厂 的 档案 。 工厂 因 严重 事故 关闭 ， 官方 报告 认为 原因 是 设备 故障 。', 'Researcher Shen Qing is cataloguing an old factory archive. The factory closed after a serious accident, officially blamed on equipment failure.'),
        p('她 在 地下室 找到 一份 没有 编号 的 报告 。 报告 显示 管理 人员 早已 知道 风险 ， 却 决定 继续 生产 。', 'In the basement she finds an unnumbered report showing that management knew the risk and chose to continue production.'),
      ]),
      chapter('熟悉的签名', 'A Familiar Signature', ['签名', '导师', '证据'], [
        p('报告 下面 有 她 导师 的 签名 。 三十年 前 ， 导师 是 工厂 工程师 ， 也 是 建议 继续 运行 的 人 。', 'The report bears her mentor’s signature. Thirty years earlier, he was the factory engineer who advised continued operation.'),
        p('导师 曾经 帮助 沈青 完成 学业 ， 她 很难 相信 这份 证据 。 他 请求 她 暂时 保密 ， 说 当时 受到 高层 压力 。', 'Her mentor helped her complete her studies, and she struggles to believe the evidence. He asks for secrecy, saying senior leaders pressured him.'),
      ]),
      chapter('档案不是判决', 'An Archive Is Not a Verdict', ['公开', '责任', '解释'], [
        p('沈青 最终 公开 报告 ， 同时 收录 导师 对 当年 处境 的 完整 解释 。 她 不 替 他 判断 动机 ， 也 不 否认 他 的 责任 。', 'Shen Qing publishes the report alongside her mentor’s full account of the circumstances. She neither judges his motive nor denies his responsibility.'),
        p('导师 失去 一些 荣誉 ， 却 第一次 向 受伤 工人 道歉 。 沈青 明白 ， 档案 不是 最终 判决 ， 但 没有 档案 就 没有 公正 的 讨论 。', 'Her mentor loses honours but apologises to injured workers for the first time. Shen Qing learns that an archive is not a final verdict, but fair discussion is impossible without it.'),
      ]),
    ]
  ),
  story(
    6,
    'lighthouse-letter',
    '灯塔来信',
    'The Letter from the Lighthouse',
    'A coastal engineer receives warnings from a lighthouse officially listed as empty.',
    'Gu Yan wants to inspect an automated lighthouse before a major storm.',
    'Anonymous letters claim its safety system has failed.',
    'She follows the evidence and finds the retired keeper protecting passing ships.',
    [
      chapter('没有人的地址', 'An Empty Address', ['来信', '灯塔', '警告'], [
        p('工程师 顾言 连续 收到 三封 来信 ， 地址 是 一座 已经 自动 运行 的 灯塔 。 信 中 警告 ： 导航 灯 经常 突然 停止 。', 'Engineer Gu Yan receives three letters from an automated lighthouse. They warn that its navigation light often stops suddenly.'),
        p('管理 部门 说 灯塔 没有人 居住 ， 系统 记录 也 一切 正常 。 暴风雨 即将 到来 ， 顾言 决定 亲自 前往 。', 'The authority says nobody lives there and system records are normal. With a storm approaching, Gu Yan decides to inspect it herself.'),
      ]),
      chapter('岛上的守护者', 'The Keeper on the Island', ['故障', '老人', '隐瞒'], [
        p('顾言 在 岛上 发现 一位 退休 老人 。 他 曾经 是 灯塔 管理员 ， 发现 设备 故障 后 一直 私自 留在 岛上 维修 。', 'On the island, Gu Yan finds a retired keeper. After discovering an equipment fault, he stayed without permission to repair it.'),
        p('老人 隐瞒 身份 ， 因为 部门 多次 忽略 他的 警告 。 可 他 的 私人 维修 也 改变 了 系统 数据 ， 让 风险 更 难 判断 。', 'He hid his identity because officials repeatedly ignored his warnings. Yet his private repairs altered system data, making the risk harder to assess.'),
      ]),
      chapter('风暴之前', 'Before the Storm', ['撤离', '修复', '承诺'], [
        p('顾言 说服 老人 撤离 ， 并 把 原始 记录 发送 给 港口 。 技术 团队 在 风暴 前 修复 了 核心 部件 。', 'Gu Yan persuades him to evacuate and sends the original records to the port. A technical team repairs the core component before the storm.'),
        p('部门 承诺 调查 为什么 警告 被 忽略 ， 也 请 老人 作为 顾问 回来 。 最后 一封 灯塔 来信 公开 写 上 了 老人 的 名字 。', 'The authority promises to investigate why the warnings were ignored and invites the keeper back as an adviser. The final lighthouse letter openly bears the keeper’s name.'),
      ]),
    ]
  ),
  story(
    6,
    'second-witness',
    '第二个证人',
    'The Second Witness',
    'A witness changes her account after noticing what everyone else assumed.',
    'Ye Zhen wants to give accurate evidence about a traffic accident.',
    'Her memory conflicts with the first witness and with a video.',
    'She reconstructs the scene and exposes a misleading camera angle.',
    [
      chapter('十秒钟', 'Ten Seconds', ['事故', '证人', '记忆'], [
        p('叶真 是 一场 交通 事故 的 第二个 证人 。 她 只 看到 十秒钟 ， 却 清楚 记得 红车 先 冲进 路口 。', 'Ye Zhen is the second witness to a traffic accident. She saw only ten seconds but clearly remembers the red car entering the junction first.'),
        p('第一个 证人 认为 蓝车 超速 ， 附近 摄像机 的 画面 似乎 也 支持 他 。 叶真 开始 怀疑 自己 的 记忆 。', 'The first witness says the blue car was speeding, and nearby camera footage seems to support him. Ye Zhen begins doubting her memory.'),
      ]),
      chapter('画面之外', 'Outside the Frame', ['角度', '现场', '核对'], [
        p('叶真 回到 现场 ， 按 自己 当时 的 位置 重新 观察 。 她 发现 摄像机 的 角度 看 不 到 一个 临时 交通 标志 。', 'Ye Zhen returns to the scene and observes from her original position. The camera angle misses a temporary traffic sign.'),
        p('她 又 核对 天气 和 道路 记录 。 大风 曾经 把 标志 转向 ， 两辆车 看到 的 指示 完全 不同 。', 'She checks weather and road records. Strong wind had turned the sign, so the two drivers saw entirely different instructions.'),
      ]),
      chapter('改变证词', 'Changing the Testimony', ['证词', '承认', '真相'], [
        p('叶真 修改 了 自己 的 证词 。 她 承认 红车 先 进入 路口 ， 但 不再 认为 司机 故意 违反 规则 。', 'Ye Zhen changes her testimony. She confirms the red car entered first but no longer believes its driver knowingly broke the rules.'),
        p('新 证据 也 证明 蓝车 没有 超速 。 真相 不是 两个 证人 谁 对 谁 错 ， 而是 一个 被 风 改变 的 标志 。', 'The new evidence also proves the blue car was not speeding. The truth is not that one witness was right and the other wrong, but that wind had turned a sign.'),
      ]),
    ]
  ),
  story(
    6,
    'paper-bridge',
    '纸上的桥',
    'The Bridge on Paper',
    'A young engineer challenges a celebrated bridge design before construction begins.',
    'Lu Wen wants to prove himself on a major bridge project.',
    'His calculations reveal a flaw nobody wants announced.',
    'A public test replaces pride with better engineering.',
    [
      chapter('完美的设计', 'The Perfect Design', ['桥梁', '设计', '工程师'], [
        p('年轻 工程师 陆文 加入 一座 大型 桥梁 项目 。 设计 来自 一位 著名 大师 ， 媒体 称 它 是 完美 的 工程 。', 'Young engineer Lu Wen joins a major bridge project. A famous master designed it, and the media calls it perfect engineering.'),
        p('陆文 负责 核对 材料 数据 。 他 发现 在 特定 风向 下 ， 桥梁 中部 可能 发生 不 正常 的 振动 。', 'Lu Wen checks material data and discovers that a particular wind direction may cause abnormal vibration at the bridge’s centre.'),
      ]),
      chapter('没有人想听', 'Nobody Wants to Hear It', ['计算', '风险', '质疑'], [
        p('陆文 重复 计算 ， 结果 仍然 相同 。 项目 负责人 担心 推迟 建造 会 增加 成本 ， 要求 他 不要 公开 质疑 大师 。', 'Lu Wen repeats the calculations with the same result. The project director fears delay will raise costs and tells him not to question the master publicly.'),
        p('同事 也 提醒 他 ， 一个 新人 挑战 大师 可能 失去 职位 。 陆文 却 认为 隐瞒 风险 会 威胁 以后 每个 使用 桥梁 的 人 。', 'Colleagues warn that a newcomer challenging a master could lose his job. Lu Wen believes hiding the risk would threaten every future bridge user.'),
      ]),
      chapter('让模型回答', 'Let the Model Answer', ['模型', '测试', '改进'], [
        p('陆文 没有 在 网络 上 指责 任何 人 ， 而是 建议 对 桥梁 模型 进行 公开 风力 测试 。 大师 亲自 同意 了 。', 'Lu Wen accuses nobody online; he proposes a public wind test of a bridge model. The master agrees personally.'),
        p('测试 证明 风险 存在 ， 团队 因此 改进 结构 。 大师 对 陆文 说 ： “ 好 工程师 保护 的 不是 自己 的 面子 ， 是 桥上的 人 。 ”', 'The test confirms the risk, and the team improves the structure. The master tells Lu Wen, “A good engineer protects not his pride, but the people on the bridge.”'),
      ]),
    ]
  ),
  story(
    6,
    'borrowed-name',
    '借来的名字',
    'The Borrowed Name',
    'An editor discovers that a prize-winning story belongs to someone else.',
    'Editor Han Qiu wants to publish a brilliant new writer.',
    'The manuscript was copied from an unknown hospital patient.',
    'She delays publication and helps the real author reclaim the work.',
    [
      chapter('新人作品', 'A Newcomer’s Work', ['作品', '作者', '出版'], [
        p('编辑 韩秋 收到 一部 非常 出色 的 小说 。 作者 是 没有 名气 的 新人 ， 出版社 却 认为 作品 一定 会 获奖 。', 'Editor Han Qiu receives an excellent novel by an unknown newcomer. The publisher believes it is certain to win prizes.'),
        p('出版 前 ， 韩秋 发现 小说 中 一段 话 和 医院 网站 上 的 病人 日记 完全 相同 。 她 开始 调查 作者 的 来源 。', 'Before publication, Han Qiu discovers a passage identical to a patient diary on a hospital website. She begins investigating the author’s sources.'),
      ]),
      chapter('谁写的故事', 'Who Wrote the Story?', ['抄袭', '承认', '权利'], [
        p('新人 最后 承认 ， 整个 故事 来自 同一个 病人 的 手写 材料 。 他 认为 病人 已经 去世 ， 没有人 会 争 这个 作品 的 作者 身份 。', 'The newcomer admits the entire story came from one patient’s handwritten material. He assumed the patient was dead and nobody would contest the authorship.'),
        p('出版社 已经 投入 大量 资金 ， 要求 韩秋 只 删除 相同 段落 。 她 拒绝 ， 因为 问题 不是 几句 抄袭 ， 而是 借用 别人 的 人生 。', 'The publisher has invested heavily and asks Han Qiu only to remove matching passages. She refuses: the issue is not a few copied sentences, but borrowing someone else’s life.'),
      ]),
      chapter('真正的署名', 'The Real Byline', ['寻找', '署名', '尊重'], [
        p('韩秋 通过 医院 寻找 病人 家属 ， 发现 病人 仍然 活着 ， 只是 因为 身体 原因 无法 完成 出版 。', 'Through the hospital, Han Qiu looks for the patient’s family and discovers the patient is alive but unable to finish publication because of illness.'),
        p('她 暂停 原来 的 计划 ， 请 病人 修改 作品 并 使用 自己 的 名字 。 一年 后 小说 出版 ， 封面 没有 新人 的 名字 ， 却 尊重 了 故事 的 主人 。', 'She pauses the original plan and asks the patient to revise and publish under the true name. A year later, the novel appears without the newcomer’s name, respecting the story’s owner.'),
      ]),
    ]
  ),

  // HSK 7
  story(
    7,
    'echoes-in-the-archive',
    '档案里的回声',
    'Echoes in the Archive',
    'An archivist finds a testimony that challenges the heroic legend of a city founder.',
    'Gu Yan wants to prepare an honest exhibition about the city’s founder.',
    'A forgotten witness describes a forced evacuation omitted from official history.',
    'The exhibition presents achievement and harm together.',
    [
      chapter('没有编号的录音', 'The Unnumbered Recording', ['档案', '编号', '传闻'], [
        p('顾言 为 城市 建立 百年 展览 整理 档案 。 她 在 一批 没有 编号 的 材料 中 发现 一段 老人 录音 。', 'Gu Yan is preparing a centenary exhibition from the city archive. Among unnumbered materials, she finds an elderly person’s recording.'),
        p('录音 提到 一个 长期 被 当作 传闻 的 事件 ： 城市 建设 初期 ， 一些 家庭 被迫 离开 土地 。 这个 传闻 从未 进入 正式 档案 。', 'It describes an event long dismissed as rumour: families were forced from their land early in the city’s development. The rumour never entered the official archive.'),
      ]),
      chapter('英雄的另一面', 'The Other Side of a Hero', ['证人', '查明', '推断'], [
        p('录音 中 的 证人 已经 去世 。 顾言 只能 通过 地图 、 信件 和 当年 报刊 查明 他的 身份 ， 再 推断 事件 过程 。', 'The witness is dead. Gu Yan must use maps, letters, and newspapers to establish his identity and infer what occurred.'),
        p('更多 证人 材料 证明 搬迁 确实 发生 ， 但 无法 证明 城市 创立者 亲自 下令 。 顾言 拒绝 从 不完整 证据 推断 他的 动机 。', 'Further testimony confirms the removals, but not that the founder personally ordered them. Gu Yan refuses to infer motive from incomplete evidence.'),
      ]),
      chapter('纪念谁', 'Whom Do We Remember?', ['反思', '创伤', '担当'], [
        p('部分 官员 担心 展览 破坏 英雄 形象 。 顾言 回答 ， 纪念 成就 不 应 要求 受害 家庭 再次 隐藏 创伤 。', 'Some officials fear the exhibition will damage a heroic image. Gu Yan argues that honouring achievement should not require harmed families to hide their trauma again.'),
        p('最终 展览 同时 呈现 建设 成果 、 证人 录音 和 尚未 确定 的 问题 。 城市 没有 放弃 传奇 ， 而是 开始 反思 传奇 ， 承担 历史 的 全部 重量 。', 'The exhibition presents achievements, testimony, and unresolved questions together. The city does not abandon its legend; it reflects on it and accepts the full weight of its history.'),
      ]),
    ]
  ),
  story(
    7,
    'wetland-boundary',
    '湿地边界',
    'The Wetland Boundary',
    'An ecologist discovers that moving one line on a map could erase a living habitat.',
    'Zheng He wants to complete an ecological survey before construction begins.',
    'The official boundary excludes the wetland’s most important seasonal area.',
    'New evidence redraws the project and the meaning of protection.',
    [
      chapter('地图上的直线', 'A Straight Line on the Map', ['生态', '边界', '调查'], [
        p('生态 调查员 郑禾 负责 确定 一片 湿地 的 保护 边界 。 地图 上 的 边界 是 一条 直线 ， 施工 区域 在 直线 外 。', 'Ecological surveyor Zheng He must define the protected boundary of a wetland. On the map it is a straight line, with construction outside it.'),
        p('实地 调查 时 ， 他 发现 大量 鸟类 每年 都 在 边界 外 繁殖 。 如果 只 保护 地图 内部 ， 整个 生态 系统 仍 会 受到 破坏 。', 'Fieldwork shows many birds breed annually outside the boundary. Protecting only the mapped area would still damage the whole ecosystem.'),
      ]),
      chapter('雨季的证据', 'Evidence from the Rainy Season', ['采集', '推断', '使命'], [
        p('开发 公司 认为 一次 观察 不足以 改变 工程 。 郑禾 连续 数周 采集 水位 和 鸟群 数据 ， 推断 雨季 水流 的 真实 范围 。', 'The developer says one observation cannot alter the project. For weeks, Zheng He gathers water-level and bird data to infer the true rainy-season range.'),
        p('公司 提醒 他 ， 推迟 工程 会 影响 就业 。 郑禾 的 使命 不是 反对 发展 ， 而是 让 做 决定 的 人 看见 地图 直线 忽略 的 事实 。', 'The company notes that delay affects jobs. Zheng He’s mission is not to oppose development but to make decision-makers see the facts ignored by a straight line on a map.'),
      ]),
      chapter('会移动的边界', 'A Boundary That Moves', ['保护', '方案', '担当'], [
        p('新 方案 采用 随 季节 移动 的 保护 边界 ， 并 把 部分 建筑 转移 到 高地 。 工程 规模 变小 ， 但 不必 完全 取消 。', 'The new plan uses a seasonally shifting boundary and moves some construction to higher ground. The project shrinks but need not be cancelled.'),
        p('郑禾 在 报告 中 写道 ： “ 自然 的 边界 会 移动 ， 人 的 担当 不能 移动 。 ” 保护 不再 是 地图 上 的 一条 线 。', 'Zheng He writes, “Nature’s boundaries move; human responsibility must not.” Protection is no longer merely a line on a map.'),
      ]),
    ]
  ),
  story(
    7,
    'witness-at-dawn',
    '黎明的证人',
    'The Witness at Dawn',
    'A witness certain of what she saw discovers that certainty can be misleading.',
    'Ye Zhen wants to help solve an assault case.',
    'Her identification conflicts with physical evidence.',
    'She separates what she saw from what fear made her assume.',
    [
      chapter('窗外的人', 'The Person Outside', ['案件', '证人', '查明'], [
        p('黎明 前 ， 叶真 从 窗口 看到 一个人 从 邻居 家 跑 出 。 当天 警察 调查 一起 案件 ， 她 成为 唯一 证人 。', 'Before dawn, Ye Zhen sees someone run from a neighbour’s home. When police investigate an assault, she becomes the only witness.'),
        p('叶真 相信 自己 认识 那个人 ， 要求 警察 立刻 查明 他的 位置 。 被 她 指认 的 是 附近 一名 有 犯罪 记录 的 男子 。', 'Certain she knows him, Ye Zhen urges police to locate him. She identifies a local man with a criminal record.'),
      ]),
      chapter('记忆的空白', 'The Gap in Memory', ['推断', '沉着', '证据'], [
        p('男子 有 不在场 的 证据 ， 衣服 颜色 也 不同 。 调查员 请 叶真 沉着 回忆 ， 不要 从 对方 的 过去 推断 当晚 的 身份 。', 'The man has an alibi, and his clothes differ. Investigators ask Ye Zhen to recall calmly rather than infer identity from his past.'),
        p('叶真 意识 到 ， 她 只 看清 相似 的 身高 和 走路 动作 。 恐惧 却 让 她 根据 这些 有限 证据 确定 了 那个 人 的 身份 。', 'Ye Zhen realises she saw only a similar height and gait. Fear had made her assign an identity from that limited evidence.'),
      ]),
      chapter('重新作证', 'Testifying Again', ['承认', '偏差', '公正'], [
        p('叶真 重新 作证 ， 公开 承认 自己 无法 确定 身份 。 她 的 改变 让 调查 回到 其他 线索 ， 也 保护 无辜 男子 。', 'Ye Zhen testifies again and admits she cannot identify the person. Her change returns the investigation to other clues and protects an innocent man.'),
        p('真正 的 嫌疑人 后来 因 物证 被捕 。 叶真 明白 ， 公正 不 要求 证人 永远 正确 ， 而 要求 证人 有 勇气 承认 记忆 的 偏差 。', 'The true suspect is later arrested through physical evidence. Ye Zhen learns justice does not require a witness always to be right, but to admit memory’s bias.'),
      ]),
    ]
  ),
  story(
    7,
    'last-artifact',
    '最后一件文物',
    'The Last Artifact',
    'A museum curator questions the celebrated origin of its most valuable object.',
    'Bai Lu wants to complete a catalogue of the museum collection.',
    'The final artifact may have been removed illegally from a village.',
    'The museum returns ownership while preserving public access.',
    [
      chapter('空白的编号', 'The Blank Catalogue Number', ['文物', '编号', '出土'], [
        p('白露 整理 博物馆 文物 时 ， 发现 最后 一件 文物 没有 原始 编号 。 说明 只 写 着 “ 百年 前 出土 ” 。', 'While cataloguing museum artifacts, Bai Lu finds the final object has no original number. Its label says only “excavated a century ago.”'),
        p('文物 是 博物馆 最 有名 的 藏品 。 如果 无法 确定 出土 地点 和 来源 ， 它 的 所有权 就 可能 存在 问题 。', 'It is the museum’s most famous object. Without a confirmed excavation site and source, its ownership may be in question.'),
      ]),
      chapter('村里的传闻', 'The Village Account', ['传闻', '鉴定', '查找'], [
        p('白露 根据 旧 照片 查找 地点 ， 来到 一个 边远 村庄 。 村里 有 一个 传闻 ： 文物 当年 被 外地 商人 低价 带走 。', 'Using old photographs, Bai Lu traces the place to a remote village. A local account says a trader took the artifact away cheaply.'),
        p('她 请 专家 重新 鉴定 材料 ， 又 比较 村里 保留 的 出土 记录 。 科学 鉴定 和 口头 传闻 最终 指向 同一个 地方 。', 'She asks experts to authenticate the material and compares village excavation records. Scientific analysis and oral accounts point to the same place.'),
      ]),
      chapter('回去，也留下', 'Returning and Remaining', ['归还', '传承', '担当'], [
        p('博物馆 决定 把 文物 所有权 归还 村庄 。 村里 的 人 没有 要求 立刻 搬走 ， 而是 和 博物馆 共同 设计 新 展览 。', 'The museum returns ownership to the village. Residents do not demand immediate removal; they jointly design a new exhibition.'),
        p('文物 仍 在 原 展览 房间 ， 说明 中 却 写 清楚 了 真正 来源 和 归还 过程 。 博物馆 不再 占有 文物 ， 而是 以 更 诚实 的 方式 承担 传承 责任 。', 'The artifact remains in its gallery, but its label now states its true origin and return. The museum no longer possesses it and instead accepts responsibility for presenting its history honestly.'),
      ]),
    ]
  ),
  story(
    7,
    'unfinished-voyage',
    '没有完成的航海',
    'The Unfinished Voyage',
    'A captain abandons a record attempt when an unknown boat calls for help.',
    'Captain Xu Chuan wants to complete a historic solo voyage.',
    'A distress signal comes from outside his planned route.',
    'He gives up the record and discovers a different legacy.',
    [
      chapter('最后一段海路', 'The Final Sea Passage', ['航海', '传奇', '边界'], [
        p('许川 的 单人 航海 只 剩 最后 一段 。 一旦 穿过 北方 海域 的 边界 ， 他 就 会 创造 新 记录 ， 成为 航海 传奇 。', 'Xu Chuan has only one passage left in his solo voyage. Crossing the northern boundary will set a record and make him a sailing legend.'),
        p('天气 开始 恶化 ， 但 仍 在 安全 范围 。 团队 建议 他 继续 ， 因为 下一次 适合 航海 的 机会 可能 在 一年 后 。', 'Weather worsens but remains within safe limits. His team recommends continuing because the next suitable opportunity may be a year away.'),
      ]),
      chapter('边界外的信号', 'A Signal Beyond the Boundary', ['信号', '处境', '使命'], [
        p('夜里 ， 许川 收到 一个 微弱 求救 信号 。 一艘 小船 在 计划 边界 外 失去 动力 ， 船员 的 处境 越来越 危险 。', 'At night, Xu Chuan receives a faint distress signal. A small boat beyond his planned boundary has lost power, and its crew is in growing danger.'),
        p('改变 方向 意味着 放弃 记录 。 许川 想起 船长 的 第一 使命 不是 完成 路线 ， 而是 回应 海上 的 求救 。', 'Changing course means abandoning the record. Xu Chuan remembers a captain’s first mission is not to finish a route but to answer distress at sea.'),
      ]),
      chapter('另一张航海图', 'Another Chart', ['救援', '反思', '担当'], [
        p('许川 转向 并 完成 救援 ， 随后 因 燃料 不足 返回 港口 。 他的 航海 没有 完成 ， 记录 后来 由 别人 创造 。', 'Xu Chuan turns, completes the rescue, then returns to port with too little fuel. His voyage remains unfinished, and someone else later sets the record.'),
        p('他 后来 在 航海图 上 标出 救援 地点 ， 用来 培训 年轻 船员 。 放弃 记录 的 决定 让 大家 反思 ： 真正 的 传奇 来自 担当 ， 不只 来自 终点 。', 'He later marks the rescue site on charts used to train young sailors. His decision to give up the record prompts reflection: true legend comes from responsibility, not only the finish.'),
      ]),
    ]
  ),

  // HSK 8
  story(
    8,
    'wall-beneath-the-station',
    '车站下面的墙',
    'The Wall Beneath the Station',
    'Construction uncovers a mural that could delay the city’s most important rail line.',
    'Archaeologist Tang Xin wants to protect a newly discovered mural.',
    'Preservation threatens transport plans and public trust.',
    'A redesigned station makes the discovery part of daily city life.',
    [
      chapter('地下的颜色', 'Colour Underground', ['壁画', '遗址', '残缺'], [
        p('地铁站 施工 时 ， 工人 在 地下 发现 一面 古老 壁画 。 壁画 虽然 残缺 ， 仍然 呈现 过去 城市 生活 的 细节 。', 'During metro construction, workers uncover an ancient mural. Though incomplete, it still depicts details of past city life.'),
        p('考古 人员 唐心 判断 这里 可能 是 重要 遗址 。 按 法律 ， 施工 必须 暂停 ， 直到 遗址 价值 得到 确认 。', 'Archaeologist Tang Xin believes the site may be significant. By law, construction must pause until its value is established.'),
      ]),
      chapter('每一天的代价', 'The Cost of Every Day', ['核实', '质疑', '保障'], [
        p('地铁 公司 说 每 停 一天 都 会 增加 巨额 成本 ， 并 质疑 壁画 是否 真正 古老 。 唐心 必须 尽快 核实 年代 。', 'The metro company says every day of delay adds enormous cost and questions whether the mural is truly ancient. Tang Xin must verify its age quickly.'),
        p('同时 ， 居民 担心 保护 遗址 会 让 等待 多年 的 交通 再次 推迟 。 文化 保障 和 现实 需求 看起来 无法 同时 满足 。', 'Residents fear preservation will further delay transport they have awaited for years. Cultural protection and practical need seem incompatible.'),
      ]),
      chapter('让城市看见', 'Let the City See It', ['承载', '传承', '设计'], [
        p('鉴定 结果 证明 壁画 真实 。 唐心 和 工程师 提出 改变 站台 设计 ， 让 壁画 留在 原地 并 受到 保护 。', 'Authentication confirms the mural is genuine. Tang Xin and engineers redesign the platform so it remains protected in place.'),
        p('新 车站 晚 开放 三个月 ， 却 每天 让 乘客 看到 壁画 。 一面 残缺 的 墙 同时 承载 交通 和 传承 ， 遗址 不再 与 城市 分开 。', 'The station opens three months late, but lets passengers see the mural daily. One incomplete wall carries both transport and heritage; the site is no longer separated from the city.'),
      ]),
    ]
  ),
  story(
    8,
    'the-algorithms-answer',
    '算法的答案',
    'The Algorithm’s Answer',
    'A data scientist discovers that an efficient hiring system repeats an old prejudice.',
    'Data scientist Lu Wen wants to improve a successful hiring tool.',
    'The tool rejects qualified applicants from one district.',
    'He exposes the bias and rebuilds the system with human review.',
    [
      chapter('百分之九十', 'Ninety Percent', ['人工智能', '效率', '数据'], [
        p('陆文 的 团队 开发 人工智能 招聘 系统 ， 可以 自动 选择 最 合适 的 申请人 。 公司 宣布 系统 提高 了 百分之九十 的 效率 。', 'Lu Wen’s team develops an AI hiring system that automatically selects suitable applicants. The company announces a ninety-percent efficiency gain.'),
        p('陆文 检查 数据 时 ， 发现 来自 一个 老 工业区 的 申请人 几乎 全部 被 拒绝 ， 即使 他们 具备 相同 技能 。', 'While auditing the data, Lu Wen finds applicants from an old industrial district are almost all rejected, despite equal skills.'),
      ]),
      chapter('机器学会了什么', 'What the Machine Learned', ['偏见', '揭露', '抵制'], [
        p('过去 的 招聘 记录 本来 就 对 这个 地区 存在 偏见 ， 人工智能 只是 把 旧 偏见 学得 更 快 。', 'Past hiring records already contained prejudice against the district; the AI merely learned the old bias faster.'),
        p('管理层 反对 公开 这个 问题 ， 担心 揭露 偏见 会 损害 产品 名声 。 他们 建议 删除 地区 信息 后 继续 使用 。', 'Management opposes disclosing the problem, fearing exposure will harm the product. They suggest deleting district information and continuing.'),
      ]),
      chapter('谁来负责', 'Who Is Responsible?', ['核实', '保障', '尊严'], [
        p('陆文 证明 删除 一个 项目 不能 消除 与 地区 相关 的 其他 数据 。 他 暂停 系统 ， 要求 每个 决定 由 人员 再次 核实 。', 'Lu Wen proves removing one field cannot erase other district-related data. He pauses the system and requires human verification of every decision.'),
        p('新 系统 速度 变慢 ， 却 增加 了 人工 复查 的 过程 ， 申请人 也 可以 提出 不同 意见 。 公司 终于 承认 ： 算法 的 答案 仍然 需要 人 承担 责任 。', 'The revised system is slower but adds human review and lets applicants challenge decisions. The company admits that people remain responsible for an algorithm’s answers.'),
      ]),
    ]
  ),
  story(
    8,
    'moving-coastline',
    '移动的海岸线',
    'The Moving Coastline',
    'A coastal village faces relocation as the sea reaches its homes.',
    'Planner Jiang Yue wants to protect residents from rising water.',
    'Relocation protects lives but threatens identity and livelihoods.',
    'Residents lead a phased plan that preserves community ties.',
    [
      chapter('海水到门口', 'The Sea at the Door', ['海岸', '脆弱', '变迁'], [
        p('江月 负责 一个 海岸 村庄 的 安全 规划 。 多年 环境 变迁 让 海岸线 不断 后退 ， 最 外边 的 房屋 已经 十分 脆弱 。', 'Jiang Yue plans safety for a coastal village. Years of environmental change have pushed the shoreline back, leaving outer homes extremely vulnerable.'),
        p('专家 预测 下一次 强 风暴 可能 淹没 村庄 一半 区域 。 江月 建议 全体 居民 在 两年 内 搬迁 。', 'Experts predict the next severe storm may flood half the village. Jiang Yue proposes relocating everyone within two years.'),
      ]),
      chapter('安全不是全部', 'Safety Is Not Everything', ['抵制', '尊严', '困境'], [
        p('居民 强烈 抵制 搬迁 。 他们 对 祖先 的 记忆 、 工作 和 生活 方式 都 在 海岸 ， 新 住宅 只能 提供 房间 ， 不能 保护 他们 的 尊严 。', 'Residents strongly resist. Their ancestral memories, work, and way of life are rooted on the coast; new housing can offer rooms but cannot by itself protect their dignity.'),
        p('江月 陷入 困境 ： 不 搬 会 威胁 生命 ， 强迫 搬迁 又 会 破坏 社区 。 她 开始 让 居民 自己 参与 风险 评估 。', 'Jiang Yue faces a dilemma: staying risks lives, while forced relocation destroys community. She begins involving residents in risk assessment.'),
      ]),
      chapter('分阶段离开', 'Leaving in Stages', ['保障', '安抚', '传承'], [
        p('共同 方案 先 搬迁 高风险 家庭 ， 同时 在 新区 建立 鱼 市场 和 纪念 空间 ， 保障 工作 和 文化 传承 。', 'The joint plan relocates high-risk families first and creates a fish market and memorial space in the new district, protecting work and heritage.'),
        p('最后 一户 离开 时 ， 海水 已经 进入 旧 路 。 没有 方案 能 完全 安抚 失去 家园 的 悲伤 ， 但 新 社区 保留 了 彼此 的 联系 。', 'When the final household leaves, seawater has reached the old road. No plan can fully soothe the grief of losing home, but the new community preserves their ties.'),
      ]),
    ]
  ),
  story(
    8,
    'borrowed-voice',
    '被借走的声音',
    'The Borrowed Voice',
    'A documentary editor discovers that a powerful translation changes what its subject said.',
    'Editor Han Qiu wants a documentary to reach an international audience.',
    'A dramatic translation turns uncertainty into accusation.',
    'She restores the speaker’s meaning even when the film becomes less sensational.',
    [
      chapter('最有力量的一句话', 'The Most Powerful Sentence', ['纪录片', '翻译', '触动'], [
        p('韩秋 编辑 一部 关于 工厂 搬迁 的 纪录片 。 片中 一位 老 工人 的 话 十分 触动 观众 ， 成为 预告片 的 核心 。', 'Han Qiu edits a documentary about factory relocation. An elderly worker’s statement deeply moves viewers and becomes the trailer’s centrepiece.'),
        p('英文 翻译 是 ： “ 他们 故意 毁掉 我们 的 家 。 ” 这句 话 让 纪录片 获得 大量 关注 。', 'The English translation says, “They deliberately destroyed our home.” The line draws enormous attention to the documentary.'),
      ]),
      chapter('原话的分量', 'The Weight of the Original', ['核实', '质疑', '尊严'], [
        p('韩秋 核实 原始 录音 时 ， 发现 老人 实际 说 的 是 ： “ 我 不 知道 他们 是否 在乎 我们 的 家 。 ”', 'Checking the original audio, Han Qiu discovers he actually said, “I don’t know whether they cared about our home.”'),
        p('导演 质疑 修改 的 必要 ， 认为 两句 话 表达 相同 情绪 。 韩秋 却 认为 把 怀疑 变成 直接 指责 ， 等于 借走 老人 的 声音 和 尊严 。', 'The director questions whether a change is needed, saying both express the same emotion. Han Qiu argues that turning doubt into a direct accusation steals the man’s voice and dignity.'),
      ]),
      chapter('不够响亮的真话', 'A Truth That Is Less Loud', ['修改', '偏见', '负责'], [
        p('韩秋 坚持 修改 翻译 ， 并 在 纪录片 中 加入 解释 。 新 版本 不再 那么 戏剧化 ， 却 呈现 老人 对 事实 的 谨慎 。', 'Han Qiu insists on correcting the translation and adds context. The new version is less dramatic but preserves the man’s caution about facts.'),
        p('影片 仍然 引起 讨论 ， 也 揭露 观众 对 “ 受害者 一定 愤怒 ” 的 偏见 。 韩秋 明白 ， 编辑 的 责任 不是 替 别人 说得 更 响亮 。', 'The film still sparks debate and exposes the audience’s bias that victims must sound angry. Han Qiu learns an editor’s duty is not to make someone else speak more loudly.'),
      ]),
    ]
  ),
  story(
    8,
    'the-donors-condition',
    '捐款人的条件',
    'The Donor’s Condition',
    'A museum receives enough money to survive, but only if it erases a difficult exhibit.',
    'Director Shen Qing wants to keep a small regional museum open.',
    'A donor demands removal of an exhibit about his family’s company.',
    'The museum gives up the money and builds broader public support.',
    [
      chapter('能救博物馆的钱', 'Money That Can Save the Museum', ['筹集', '捐款', '保障'], [
        p('沈青 管理 的 博物馆 因 经费 不足 面临 关闭 。 她 用 半年 筹集 捐款 ， 仍然 无法 保障 员工 工资 。', 'Shen Qing’s museum faces closure from lack of funds. After six months raising donations, she still cannot guarantee staff salaries.'),
        p('一位 企业家 愿意 提供 足够 三年 运行 的 捐款 。 这笔 钱 可以 保障 博物馆 继续 开放 ， 条件 看起来 也 很 简单 。', 'A business leader offers enough funding for three years. It can keep the museum open, and the condition initially seems simple.'),
      ]),
      chapter('必须消失的展览', 'The Exhibit That Must Vanish', ['条件', '揭露', '困境'], [
        p('捐款人 要求 删除 一个 揭露 当地 工厂 污染 历史 的 展览 ， 因为 工厂 曾经 属于 他的 家族 。', 'The donor demands removal of an exhibit exposing local factory pollution because his family once owned the factory.'),
        p('沈青 陷入 困境 ： 接受 条件 会 隐藏 历史 ， 拒绝 条件 可能 让 所有 展览 一起 消失 。 员工 之间 也 出现 分歧 。', 'Shen Qing faces a dilemma: accepting hides history; refusing may make every exhibit disappear. Staff are divided.'),
      ]),
      chapter('一千个名字', 'One Thousand Names', ['抵制', '尊严', '承载'], [
        p('博物馆 最终 抵制 这个 条件 ， 公开 说明 经费 危机 。 居民 发起 少量 捐款 ， 一个月 内 有 一千 人 参加 。', 'The museum rejects the condition and openly explains its crisis. Residents start small donations, joined by a thousand people in a month.'),
        p('这些 钱 只够 维持 一年 ， 却 不以 删除 任何 记忆 为 条件 。 新 大厅 写 上 一千个 名字 ： 博物馆 承载 的 不只是 文物 ， 也是 社区 的 尊严 。', 'The money lasts only a year, but it comes with no demand that any memory be erased. The new hall carries a thousand names: a museum holds not only artifacts, but a community’s dignity.'),
      ]),
    ]
  ),

  // HSK 9
  story(
    9,
    'contract-after-the-flood',
    '洪水后的契约',
    'The Contract After the Flood',
    'A mayor must decide whether an illegal emergency contract saved the town or betrayed it.',
    'Mayor Su Ping wants to rebuild quickly after a flood.',
    'The only contractor capable of starting immediately demands secrecy and control.',
    'She exposes the agreement and subjects emergency power to public review.',
    [
      chapter('三十天', 'Thirty Days', ['洪水', '部署', '契约'], [
        p('洪水 摧毁 河边 城镇 后 ， 苏平 必须 在 三十天 内 部署 临时 住房 。 正常 招标 来不及 ， 一家公司 提出 立刻 开工 。', 'After a flood destroys a riverside town, Su Ping must deploy temporary housing within thirty days. Normal tendering is too slow, and one company offers to start immediately.'),
        p('公司 要求 签订 保密 契约 ， 并 获得 以后 重建 项目 的 优先 权 。 苏平 明白 契约 不 合 常规 ， 却 可能 挽救 整个 冬天 。', 'The company demands a confidential contract and priority over later reconstruction. Su Ping knows it violates normal practice, yet it may save the town through winter.'),
      ]),
      chapter('救援的代价', 'The Price of Rescue', ['伦理', '隐瞒', '弊端'], [
        p('住房 按时 建成 ， 居民 得到 安置 。 但是 记者 发现 契约 条款 ， 质疑 政府 借 救援 之名 隐瞒 长期 利益 交换 。', 'Housing is completed on time and residents are sheltered. But a reporter finds the terms and questions whether the government used relief as a cover for a long-term exchange of benefits.'),
        p('苏平 面临 伦理 困境 ： 公开 可能 导致 公司 停止 工作 ， 继续 隐瞒 又 会 让 紧急 权力 变成 制度 弊端 。', 'Su Ping faces an ethical dilemma: disclosure may stop work, while secrecy may turn emergency power into a systemic abuse.'),
      ]),
      chapter('公开的责任', 'Public Responsibility', ['阐述', '审查', '初衷'], [
        p('苏平 主动 公布 契约 ， 在 会议 上 阐述 当时 决策 的 初衷 和 风险 。 她 接受 独立 审查 ， 也 取消 公司 的 长期 优先 权 。', 'Su Ping publishes the contract and explains the decision’s original purpose and risks at a public meeting. She accepts independent review and cancels the company’s long-term priority.'),
        p('审查 认为 紧急 建设 必要 ， 保密 条款 却 不 正当 。 城镇 保留 住房 ， 也 颁布 新 规则 ： 危机 可以 改变 程序 ， 不能 剥夺 公众 知道 事实 的 权利 。', 'The review finds emergency construction necessary but secrecy unjustified. The town keeps the housing and adopts a rule: crisis may alter procedure, but cannot deprive the public of knowledge.'),
      ]),
    ]
  ),
  story(
    9,
    'the-useful-lie',
    '有用的谎言',
    'The Useful Lie',
    'A doctor’s reassuring statement calms a city, then begins to undermine public trust.',
    'Doctor Bai Lu wants to prevent panic during an unknown outbreak.',
    'She makes a claim that is comforting but unsupported.',
    'She corrects herself publicly and rebuilds trust through uncertainty.',
    [
      chapter('不会传染', 'It Is Not Contagious', ['传染', '舆论', '谎言'], [
        p('城市 出现 一种 不 知道 来源 的 疾病 ， 舆论 迅速 陷入 恐慌 。 医生 白露 在 记者会 上 说 ： “ 目前 看来 ， 它 不会 人与人 传染 。 ”', 'An unknown illness appears and public opinion descends into panic. At a press conference, Dr Bai Lu says, “At present, it does not appear to spread person to person.”'),
        p('这句话 立刻 安抚 舆论 ， 但 白露 清楚 证据 只是 不足 ， 并非 已经 排除 传染 。 一个 有用 的 谎言 开始 流传 。', 'The statement immediately calms opinion, but Bai Lu knows evidence is merely insufficient, not that transmission has been ruled out. A useful lie begins to circulate.'),
      ]),
      chapter('第一例证明', 'The First Proof', ['隐瞒', '崩溃', '背叛'], [
        p('两天 后 ， 新的 病人 证明 疾病 可以 传染 。 部门 建议 暂时 隐瞒 ， 以免 医院 系统 因 恐慌 崩溃 。', 'Two days later, a new case proves transmission. Officials advise temporary secrecy to keep the hospital system from collapsing in panic.'),
        p('白露 意识 到 ， 每 隐瞒 一小时 ， 她 的 保证 就 更 像 背叛 。 一旦 真相 由 别人 揭露 ， 公众 可能 连 正确 建议 也 不再 相信 。', 'Bai Lu realises each hour of secrecy makes her reassurance more of a betrayal. If others reveal the truth, the public may stop trusting even correct advice.'),
      ]),
      chapter('承认不知道', 'Admitting Not Knowing', ['澄清', '惭愧', '信任'], [
        p('白露 重新 召开 记者会 ， 澄清 证据 并 承认 自己 当时 说得 过于 确定 。 她 说 自己 很 惭愧 ， 也 承诺 每天 更新 并 公布 数据 。', 'Bai Lu holds another press conference, clarifies the evidence, and admits she spoke with too much certainty. She expresses shame and promises to update and publish the data daily.'),
        p('舆论 再次 激烈 ， 却 逐渐 接受 “ 尚不清楚 ” 也是 诚实 答案 。 白露 失去 完美 权威 的 形象 ， 换回 了 建立 在 公开 数据 上 的 信任 。', 'Public opinion flares again, but gradually accepts that “not yet known” can be honest. Bai Lu loses an image of perfect authority and regains trust grounded in public data.'),
      ]),
    ]
  ),
  story(
    9,
    'museum-of-apologies',
    '道歉博物馆',
    'The Museum of Apologies',
    'A nation offers to return sacred objects, but the receiving community questions the ceremony.',
    'Curator Gu Yan wants to complete a historic return of cultural objects.',
    'The official ceremony centres the institution rather than the harmed community.',
    'The community rewrites the return on its own terms.',
    [
      chapter('百年后的归还', 'Returned After a Century', ['归还', '仪式', '尊严'], [
        p('顾言 负责 把 一批 百年 前 被 带走 的 神圣 物品 归还 原 社区 。 博物馆 准备 大型 仪式 ， 宣传 这是 历史性 道歉 。', 'Gu Yan is returning sacred objects taken from a community a century ago. The museum plans a grand ceremony presented as a historic apology.'),
        p('社区 代表 欢迎 归还 ， 却 认为 仪式 把 博物馆 放在 中心 ， 再次 把 他们 的 尊严 当作 展览 内容 。', 'Community representatives welcome the return but say the ceremony centres the museum and once again turns their dignity into an exhibit.'),
      ]),
      chapter('谁接受道歉', 'Who Accepts an Apology?', ['妥协', '伦理', '阐述'], [
        p('政府 希望 双方 妥协 ： 保留 媒体 仪式 ， 同时 允许 社区 私下 进行 传统 活动 。 社区 拒绝 把 自己 的 仪式 放到 幕后 。', 'The government seeks compromise: keep the media event while allowing a private traditional ceremony. The community refuses to move its ceremony backstage.'),
        p('顾言 在 伦理 委员会 阐述 问题 ： 道歉 如果 规定 对方 如何 接受 ， 就 仍然 是 权力 的 表演 。 妥协 不能 要求 受害者 再次 沉默 。', 'Gu Yan tells the ethics committee that an apology dictating how it is accepted remains a performance of power. Compromise cannot require harmed people to be silent again.'),
      ]),
      chapter('没有领导的仪式', 'A Ceremony Without Leaders', ['初衷', '传承', '秉承'], [
        p('最终 仪式 取消 由 领导 主持 的 开幕 活动 和 官员 演讲 ， 由 社区 决定 时间 与 过程 。 博物馆 只 公开 来源 记录 和 归还 承诺 。', 'The ceremony drops its leader-hosted opening and official speeches. The community chooses the time and process; the museum publishes only provenance records and its commitment.'),
        p('顾言 说 ， 道歉 的 初衷 不 应 是 完成 机构 形象 ， 而是 建立 平等 的 新 关系 。 物品 回到 家园 ， 传承 的 主人 也 重新 得到 发言权 。', 'Gu Yan says an apology should not complete an institution’s image but establish a new relationship between equals. The objects return home, and the owners of the tradition regain their voice.'),
      ]),
    ]
  ),
  story(
    9,
    'inheritance-of-silence',
    '沉默的遗产',
    'An Inheritance of Silence',
    'A daughter inherits a company and evidence of the harm that built it.',
    'Jiang Yue wants to preserve the family company and its employees.',
    'Old records reveal compensation deliberately withheld from injured workers.',
    'She treats truth and repair as part of the inheritance.',
    [
      chapter('保险箱里的名单', 'The List in the Safe', ['继承', '名单', '隐瞒'], [
        p('父亲 去世 后 ， 江月 继承 家族 公司 。 她 在 保险箱 里 发现 一份 工人 名单 和 多年 医疗 记录 。', 'After her father dies, Jiang Yue inherits the family company. In a safe, she finds a worker list and years of medical records.'),
        p('记录 证明 公司 曾经 隐瞒 有毒 材料 导致 的 疾病 ， 并 拒绝 支付 合理 补偿 。 这份 名单 也是 她 继承 的 一部分 。', 'The records prove the company hid illnesses caused by toxic materials and denied fair compensation. The list is also part of her inheritance.'),
      ]),
      chapter('公司会不会崩溃', 'Will the Company Collapse?', ['崩溃', '弊端', '背叛'], [
        p('律师 警告 ， 公开 记录 可能 让 公司 因 赔偿 而 崩溃 ， 数千 员工 会 失去 工作 。 他 建议 依法 保持 沉默 。', 'Lawyers warn disclosure may collapse the company under compensation claims and cost thousands of jobs. They advise legally maintaining silence.'),
        p('江月 却 认为 ， 继续 隐瞒 不只是 制度 弊端 ， 也是 对 受害 工人 和 现有 员工 的 双重 背叛 。', 'Jiang Yue believes continued secrecy is not only a systemic abuse but a double betrayal of injured and current workers.'),
      ]),
      chapter('遗产的全部价格', 'The Full Price of the Inheritance', ['补偿', '阐述', '担当'], [
        p('江月 公布 记录 ， 出售 家族 部分 股份 建立 补偿 基金 。 她 向 员工 阐述 风险 ， 也 接受 独立 人员 监督 。', 'Jiang Yue publishes the records and sells part of the family stake to create a compensation fund. She explains the risks to staff and accepts independent oversight.'),
        p('公司 缩小 规模 ， 却 没有 崩溃 。 江月 失去 一部分 财富 ， 得到 另一种 遗产 ： 承认 过去 ， 承担 全部 代价 的 勇气 。', 'The company shrinks but survives. Jiang Yue loses some wealth and gains another inheritance: the courage to admit the past and bear its full cost.'),
      ]),
    ]
  ),
  story(
    9,
    'last-broadcast',
    '最后一次直播',
    'The Final Broadcast',
    'A veteran presenter must report an attack while her own family remains in danger.',
    'Presenter Luo Wei wants to provide calm, verified information during a crisis.',
    'A rumour concerns the building where her son is trapped.',
    'She resists speculation, then leaves the studio when her public duty is complete.',
    [
      chapter('城市停电', 'The City Goes Dark', ['直播', '危机', '舆论'], [
        p('爆炸 导致 城市 大面积 停电 ， 主持人 罗维 负责 唯一 仍 在 运行 的 新闻 直播 。 舆论 中 充满 未经 核实 的 消息 。', 'An explosion causes a citywide blackout, and presenter Luo Wei anchors the only news broadcast still operating. Public discussion fills with unverified claims.'),
        p('她 不断 提醒 观众 避免 特定 区域 ， 只 公布 已经 证实 的 伤亡 和 救援 信息 。 这场 危机 可能 成为 她 最后 一次 直播 。', 'She repeatedly tells viewers what areas to avoid and reports only confirmed casualties and rescue information. The crisis may become her final broadcast.'),
      ]),
      chapter('屏幕上的地址', 'The Address on the Screen', ['传闻', '颤抖', '澄清'], [
        p('一条 传闻 突然 出现 ： 罗维 儿子 工作 的 大楼 可能 再次 爆炸 。 她 的 手 开始 颤抖 ， 导演 建议 立刻 停止 直播 。', 'A rumour appears that the building where Luo Wei’s son works may explode again. Her hands begin to shake, and the director suggests ending the broadcast.'),
        p('罗维 联系 不到 儿子 ， 却 仍然 不能 把 个人 恐惧 当作 新闻 。 她 要求 记者 核实 地址 ， 很快 澄清 传闻 指向 另一栋 空楼 。', 'Unable to reach her son, Luo Wei still cannot turn personal fear into news. She orders the address checked, and reporters soon clarify that the rumour concerns another, empty building.'),
      ]),
      chapter('离开镜头', 'Leaving the Camera', ['使命', '不懈', '初衷'], [
        p('救援 指示 全部 播出 后 ， 另一位 主持人 到达 。 罗维 明白 ， 不懈 工作 不 等于 永远 不能 离开 ， 于是 把 位置 交给 同事 。', 'Once all rescue guidance has aired, another presenter arrives. Luo Wei understands that dedication does not mean she can never leave, so she hands over to her colleague.'),
        p('她 在 医院 发现 儿子 平安 。 第二天 ， 罗维 回到 镜头 前 阐述 直播 初衷 ： 公共 使命 要求 专业 ， 也 不 剥夺 新闻 人员 作为 家人 的 权利 。', 'She finds her son safe at hospital. The next day, she explains the broadcast’s purpose on air: public duty demands professionalism but does not strip journalists of their rights as family members.'),
      ]),
    ]
  ),
]

await mkdir(outputDir, { recursive: true })

const expectedPerLevel = 5
for (let level = 1; level <= 9; level += 1) {
  const count = stories.filter((entry) => entry.hskLevel === level).length
  if (count !== expectedPerLevel) {
    throw new Error(`HSK ${level} has ${count} stories; expected ${expectedPerLevel}`)
  }
}

const ids = new Set(stories.map((entry) => entry.id))
if (ids.size !== stories.length) throw new Error('Reader ids must be unique')

const nextOrderByLevel = new Map()
for (const entry of stories) {
  const order = (nextOrderByLevel.get(entry.hskLevel) ?? 0) + 1
  nextOrderByLevel.set(entry.hskLevel, order)
  entry.order = order
}

for (const filename of await readdir(outputDir)) {
  if (!filename.endsWith('.json')) continue
  if (!ids.has(basename(filename, '.json'))) {
    await unlink(resolve(outputDir, filename))
  }
}

for (const entry of stories) {
  await writeFile(
    resolve(outputDir, `${entry.id}.json`),
    `${JSON.stringify(entry, null, 2)}\n`,
    'utf8'
  )
}

console.log(`Generated ${stories.length} authored readers and ${stories.length * 3} chapters.`)
