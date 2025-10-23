#!/usr/bin/env node

/**
 * Скрипт для запуска миграции к новой схеме с источниками
 */

const { migrateToSources } = require('./migrate_sources');

console.log('🚀 Запуск миграции к новой схеме с источниками...');

migrateToSources()
    .then(() => {
        console.log('🎉 Миграция завершена успешно!');
        console.log('\nТеперь вы можете:');
        console.log('  - Запустить демонстрацию: node src/demo_sources.js');
        console.log('  - Получать объявления по источникам');
        console.log('  - Анализировать статистику по источникам');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Критическая ошибка при миграции:', error);
        process.exit(1);
    });
