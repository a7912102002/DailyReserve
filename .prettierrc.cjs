module.exports = {
  tabWidth: 2, //使用2個空格縮進
  semi: false, //代碼結尾是否加分號
  trailingComma: 'none', //代碼末尾不需要逗號
  singleQuote: true, //是否使用單引號
  printWidth: 150, //超過多少字符強制換行
  arrowParens: 'avoid', //單個參數的箭頭函數不加括號x => x
  bracketSpacing: true, //對像大括號內兩邊是否加空格{ a: 0 }
  endOfLine: 'auto', //文件換行格式LF/CRLF
  useTabs: false, //不使用縮進符,而使用空格
  quoteProps: 'as-needed', //對象的key僅在必要時用引號
  jsxSingleQuote: false, // jsx不使用單引號,而使用雙引號
  jsxBracketSameLine: false, // jsx標籤的反尖括號需要換行
  rangeStart: 0, //每個文件格式化的範圍是文件的全部內容
  rangeEnd: Infinity, //結尾
  requirePragma: false, //不需要寫文件開頭的@prettier
  insertPragma: false, //不需要自動在文件開頭插入@prettier
  proseWrap: 'preserve', //使用默認的折行標準
  htmlWhitespaceSensitivity: 'css' //根據顯示樣式決定html要不要折行
}
