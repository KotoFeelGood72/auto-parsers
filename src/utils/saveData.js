const fs = require('fs');

function saveData(filename, data) {
    fs.writeFileSync(`data/${filename}.json`, JSON.stringify(data, null, 2));
    console.log(`Данные сохранены в data/${filename}.json`);
}

module.exports = { saveData };