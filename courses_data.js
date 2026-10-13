/**
 * 清水高中選修課程與學生名冊 (正式真實資料庫)
 * 任課教師：王子齊 老師
 * 帳號：cshs643
 * 課程順序：嚴格依 高一 ➔ 高二 ➔ 高三 順序排列
 */

const COURSES = [
  {
    "id": "cshs-f06",
    "code": "f06",
    "grade": 1,
    "gradeLabel": "高一選修",
    "tag": "一34",
    "name": "[一34] 基本設計+新媒體藝術",
    "shortName": "基本設計+新媒體藝術",
    "teacher": "王子齊 老師",
    "lessons": [
      "第3節",
      "第4節"
    ],
    "defaultPeriods": [
      3,
      4
    ],
    "studentCount": 16,
    "students": [
      {
        "idx": 0,
        "fieldName": "info0",
        "school": "清水高中",
        "origClass": "209",
        "seat": "04",
        "name": "林楷峰",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,209,4,林楷峰"
      },
      {
        "idx": 1,
        "fieldName": "info1",
        "school": "清水高中",
        "origClass": "209",
        "seat": "08",
        "name": "劉秉鴻",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,209,8,劉秉鴻"
      },
      {
        "idx": 2,
        "fieldName": "info2",
        "school": "清水高中",
        "origClass": "209",
        "seat": "12",
        "name": "王琬喬",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,209,12,王琬喬"
      },
      {
        "idx": 3,
        "fieldName": "info3",
        "school": "清水高中",
        "origClass": "209",
        "seat": "20",
        "name": "陳宥潔",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,209,20,陳宥潔"
      },
      {
        "idx": 4,
        "fieldName": "info4",
        "school": "清水高中",
        "origClass": "209",
        "seat": "22",
        "name": "黃亭欣",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,209,22,黃亭欣"
      },
      {
        "idx": 5,
        "fieldName": "info5",
        "school": "清水高中",
        "origClass": "209",
        "seat": "34",
        "name": "楊云晴",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,209,34,楊云晴"
      },
      {
        "idx": 6,
        "fieldName": "info6",
        "school": "清水高中",
        "origClass": "211",
        "seat": "02",
        "name": "吳浚瑋",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,2,吳浚瑋"
      },
      {
        "idx": 7,
        "fieldName": "info7",
        "school": "清水高中",
        "origClass": "211",
        "seat": "04",
        "name": "李少朋",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,4,李少朋"
      },
      {
        "idx": 8,
        "fieldName": "info8",
        "school": "清水高中",
        "origClass": "211",
        "seat": "09",
        "name": "張淮碩",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,9,張淮碩"
      },
      {
        "idx": 9,
        "fieldName": "info9",
        "school": "清水高中",
        "origClass": "211",
        "seat": "10",
        "name": "童則維",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,10,童則維"
      },
      {
        "idx": 10,
        "fieldName": "info10",
        "school": "清水高中",
        "origClass": "211",
        "seat": "11",
        "name": "黃俊翰",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,11,黃俊翰"
      },
      {
        "idx": 11,
        "fieldName": "info11",
        "school": "清水高中",
        "origClass": "211",
        "seat": "15",
        "name": "吳昱昕",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,15,吳昱昕"
      },
      {
        "idx": 12,
        "fieldName": "info12",
        "school": "清水高中",
        "origClass": "211",
        "seat": "16",
        "name": "沈雨築",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,16,沈雨築"
      },
      {
        "idx": 13,
        "fieldName": "info13",
        "school": "清水高中",
        "origClass": "211",
        "seat": "18",
        "name": "周恩汝",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,18,周恩汝"
      },
      {
        "idx": 14,
        "fieldName": "info14",
        "school": "清水高中",
        "origClass": "211",
        "seat": "22",
        "name": "林鈺華",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,22,林鈺華"
      },
      {
        "idx": 15,
        "fieldName": "info15",
        "school": "清水高中",
        "origClass": "211",
        "seat": "29",
        "name": "陳霈儒",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,211,29,陳霈儒"
      }
    ]
  },
  {
    "id": "cshs-b04",
    "code": "b04",
    "grade": 2,
    "gradeLabel": "高二選修",
    "tag": "二34",
    "name": "[二34] 進階程式設計",
    "shortName": "進階程式設計",
    "teacher": "王子齊 老師",
    "lessons": [
      "第3節",
      "第4節"
    ],
    "defaultPeriods": [
      3,
      4
    ],
    "studentCount": 15,
    "students": [
      {
        "idx": 0,
        "fieldName": "info0",
        "school": "清水高中",
        "origClass": "305",
        "seat": "02",
        "name": "吳辰彥",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,305,2,吳辰彥"
      },
      {
        "idx": 1,
        "fieldName": "info1",
        "school": "清水高中",
        "origClass": "305",
        "seat": "05",
        "name": "吳澄霖",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,305,5,吳澄霖"
      },
      {
        "idx": 2,
        "fieldName": "info2",
        "school": "清水高中",
        "origClass": "305",
        "seat": "07",
        "name": "李昱燁",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,305,7,李昱燁"
      },
      {
        "idx": 3,
        "fieldName": "info3",
        "school": "清水高中",
        "origClass": "305",
        "seat": "16",
        "name": "許凱傑",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,305,16,許凱傑"
      },
      {
        "idx": 4,
        "fieldName": "info4",
        "school": "清水高中",
        "origClass": "305",
        "seat": "19",
        "name": "陳明宙",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,305,19,陳明宙"
      },
      {
        "idx": 5,
        "fieldName": "info5",
        "school": "清水高中",
        "origClass": "305",
        "seat": "23",
        "name": "詹秉睿",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,305,23,詹秉睿"
      },
      {
        "idx": 6,
        "fieldName": "info6",
        "school": "清水高中",
        "origClass": "305",
        "seat": "38",
        "name": "顏佑安",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,305,38,顏佑安"
      },
      {
        "idx": 7,
        "fieldName": "info7",
        "school": "清水高中",
        "origClass": "307",
        "seat": "03",
        "name": "江柏諺",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,3,江柏諺"
      },
      {
        "idx": 8,
        "fieldName": "info8",
        "school": "清水高中",
        "origClass": "307",
        "seat": "12",
        "name": "紀建宇",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,12,紀建宇"
      },
      {
        "idx": 9,
        "fieldName": "info9",
        "school": "清水高中",
        "origClass": "307",
        "seat": "15",
        "name": "茹奕鈞",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,15,茹奕鈞"
      },
      {
        "idx": 10,
        "fieldName": "info10",
        "school": "清水高中",
        "origClass": "307",
        "seat": "16",
        "name": "張恩寶",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,16,張恩寶"
      },
      {
        "idx": 11,
        "fieldName": "info11",
        "school": "清水高中",
        "origClass": "307",
        "seat": "18",
        "name": "郭嘉璿",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,18,郭嘉璿"
      },
      {
        "idx": 12,
        "fieldName": "info12",
        "school": "清水高中",
        "origClass": "307",
        "seat": "32",
        "name": "王靖雯",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,32,王靖雯"
      },
      {
        "idx": 13,
        "fieldName": "info13",
        "school": "清水高中",
        "origClass": "307",
        "seat": "33",
        "name": "林宜君",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,33,林宜君"
      },
      {
        "idx": 14,
        "fieldName": "info14",
        "school": "清水高中",
        "origClass": "307",
        "seat": "34",
        "name": "林品均",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,307,34,林品均"
      }
    ]
  },
  {
    "id": "cshs-g06",
    "code": "g06",
    "grade": 3,
    "gradeLabel": "高三選修",
    "tag": "三67",
    "name": "[三67] 基本設計+新媒體藝術",
    "shortName": "基本設計+新媒體藝術",
    "teacher": "王子齊 老師",
    "lessons": [
      "第6節",
      "第7節"
    ],
    "defaultPeriods": [
      6,
      7
    ],
    "studentCount": 16,
    "students": [
      {
        "idx": 0,
        "fieldName": "info0",
        "school": "清水高中",
        "origClass": "210",
        "seat": "01",
        "name": "吳仲恩",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,210,1,吳仲恩"
      },
      {
        "idx": 1,
        "fieldName": "info1",
        "school": "清水高中",
        "origClass": "210",
        "seat": "08",
        "name": "陳竑愷",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,210,8,陳竑愷"
      },
      {
        "idx": 2,
        "fieldName": "info2",
        "school": "清水高中",
        "origClass": "210",
        "seat": "13",
        "name": "林岑希",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,210,13,林岑希"
      },
      {
        "idx": 3,
        "fieldName": "info3",
        "school": "清水高中",
        "origClass": "210",
        "seat": "19",
        "name": "陳語喬",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,210,19,陳語喬"
      },
      {
        "idx": 4,
        "fieldName": "info4",
        "school": "清水高中",
        "origClass": "210",
        "seat": "24",
        "name": "蔡涵宇",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,210,24,蔡涵宇"
      },
      {
        "idx": 5,
        "fieldName": "info5",
        "school": "清水高中",
        "origClass": "210",
        "seat": "27",
        "name": "羅永恩",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,210,27,羅永恩"
      },
      {
        "idx": 6,
        "fieldName": "info6",
        "school": "清水高中",
        "origClass": "210",
        "seat": "34",
        "name": "陳衣琳",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,210,34,陳衣琳"
      },
      {
        "idx": 7,
        "fieldName": "info7",
        "school": "清水高中",
        "origClass": "212",
        "seat": "10",
        "name": "陳聖諺",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,10,陳聖諺"
      },
      {
        "idx": 8,
        "fieldName": "info8",
        "school": "清水高中",
        "origClass": "212",
        "seat": "13",
        "name": "詹哲銨",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,13,詹哲銨"
      },
      {
        "idx": 9,
        "fieldName": "info9",
        "school": "清水高中",
        "origClass": "212",
        "seat": "17",
        "name": "何柔霈",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,17,何柔霈"
      },
      {
        "idx": 10,
        "fieldName": "info10",
        "school": "清水高中",
        "origClass": "212",
        "seat": "18",
        "name": "李孟庭",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,18,李孟庭"
      },
      {
        "idx": 11,
        "fieldName": "info11",
        "school": "清水高中",
        "origClass": "212",
        "seat": "19",
        "name": "洪奕婷",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,19,洪奕婷"
      },
      {
        "idx": 12,
        "fieldName": "info12",
        "school": "清水高中",
        "origClass": "212",
        "seat": "20",
        "name": "胡珠皙",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,20,胡珠皙"
      },
      {
        "idx": 13,
        "fieldName": "info13",
        "school": "清水高中",
        "origClass": "212",
        "seat": "25",
        "name": "陳妍希",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,25,陳妍希"
      },
      {
        "idx": 14,
        "fieldName": "info14",
        "school": "清水高中",
        "origClass": "212",
        "seat": "33",
        "name": "潘昀彤",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,33,潘昀彤"
      },
      {
        "idx": 15,
        "fieldName": "info15",
        "school": "清水高中",
        "origClass": "212",
        "seat": "35",
        "name": "賴亭安",
        "status": "present",
        "statusCode": "2",
        "baseRaw": "清水高中,212,35,賴亭安"
      }
    ]
  }
];
