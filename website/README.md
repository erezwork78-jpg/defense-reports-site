# אתר דוחות — דף דוגמה (תעשייה אווירית)

כל הקבצים נשארים תחת תיקיית `website` בתוך תיקיית **דוחות כספיים**. הנתונים המספריים מוזנים מקומית; רשימת קבצי הדוחות נסרקת מתיקיית `../01. IAI`.

## דרישות

- [Node.js](https://nodejs.org/) 18+ (כולל `npm`)

## התקנה והרצה

```bash
cd website
npm install
npm run data:iai
npm run dev
```

הדפדפן ייפתח לכתובת המקומית (בדרך כלל `http://localhost:5173`) ויציג את דף IAI ב־`/company/iai`.

## עדכון נתונים מספריים

1. ערוך את `public/data/iai-metrics.json` והזן מספרים מהדוחות (במיליוני דולר לפי השדות).
2. הרץ:

```bash
npm run data:iai
```

הפקודה מאחדת את המטריקות עם רשימת הקבצים וכותבת ל־`public/data/iai.json`.

## בנייה לפרודקשן

```bash
npm run build
npm run preview
```

## כיוון עברית (RTL)

ב־`index.html` מוגדרים `dir="rtl"` ו־`lang="he"`. עיצוב בסיסי ב־`src/index.css`.
