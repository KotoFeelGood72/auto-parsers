const { logMemoryUsage, forceGarbageCollection } = require('./browser');

class MemoryManager {
    constructor() {
        this.processedCount = 0;
        this.memoryCheckInterval = 5; // Проверяем память каждые 5 операций
        this.forceCleanupInterval = 20; // Принудительная очистка каждые 20 операций
        this.maxMemoryMB = 1024; // Максимальное использование памяти в MB
        this.cleanupThreshold = 0.8; // Порог для принудительной очистки (80% от максимума)
    }

    // Увеличиваем счетчик обработанных элементов
    increment() {
        this.processedCount++;
    }

    // Проверяем, нужно ли выполнить очистку памяти
    shouldCleanup() {
        return this.processedCount % this.memoryCheckInterval === 0;
    }

    // Проверяем, нужна ли принудительная очистка
    shouldForceCleanup() {
        return this.processedCount % this.forceCleanupInterval === 0;
    }

    // Проверяем, превышено ли максимальное использование памяти
    isMemoryHigh() {
        const used = process.memoryUsage();
        const usedMB = used.rss / 1024 / 1024;
        return usedMB > (this.maxMemoryMB * this.cleanupThreshold);
    }

    // Выполняем очистку памяти
    async cleanup(reason = 'regular') {
        console.log(`🧹 Очистка памяти (${reason}) после ${this.processedCount} операций`);
        
        // Логируем использование памяти до очистки
        logMemoryUsage();
        
        // Принудительная очистка памяти
        forceGarbageCollection();
        
        // Ждем немного для завершения очистки
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Логируем использование памяти после очистки
        console.log('📊 После очистки:');
        logMemoryUsage();
    }

    // Проверяем и выполняем очистку при необходимости
    async checkAndCleanup() {
        if (this.shouldCleanup()) {
            if (this.isMemoryHigh()) {
                await this.cleanup('high memory usage');
            } else if (this.shouldForceCleanup()) {
                await this.cleanup('scheduled cleanup');
            } else {
                // Обычная очистка
                forceGarbageCollection();
            }
        }
    }

    // Получаем статистику использования памяти
    getMemoryStats() {
        const used = process.memoryUsage();
        return {
            rss: Math.round(used.rss / 1024 / 1024),
            heapUsed: Math.round(used.heapUsed / 1024 / 1024),
            heapTotal: Math.round(used.heapTotal / 1024 / 1024),
            external: Math.round(used.external / 1024 / 1024),
            processedCount: this.processedCount
        };
    }

    // Устанавливаем новые параметры
    setConfig(config) {
        if (config.memoryCheckInterval) this.memoryCheckInterval = config.memoryCheckInterval;
        if (config.forceCleanupInterval) this.forceCleanupInterval = config.forceCleanupInterval;
        if (config.maxMemoryMB) this.maxMemoryMB = config.maxMemoryMB;
        if (config.cleanupThreshold) this.cleanupThreshold = config.cleanupThreshold;
    }
}

module.exports = { MemoryManager };
