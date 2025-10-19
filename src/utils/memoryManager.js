/**
 * Менеджер памяти для парсера
 * Отслеживает использование памяти и управляет ресурсами
 */

class MemoryManager {
    constructor() {
        this.maxMemoryUsage = 1024 * 1024 * 1024; // 1GB
        this.checkInterval = 30000; // 30 секунд
        this.isMonitoring = false;
    }

    /**
     * Запуск мониторинга памяти
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('🔍 Запущен мониторинг памяти...');
        
        this.monitorInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, this.checkInterval);
    }

    /**
     * Остановка мониторинга памяти
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        console.log('🛑 Мониторинг памяти остановлен');
    }

    /**
     * Проверка использования памяти
     */
    checkMemoryUsage() {
        const usage = process.memoryUsage();
        const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
        
        console.log(`📊 Память: ${usedMB}MB / ${totalMB}MB`);
        
        // Если память превышает лимит, запускаем сборку мусора
        if (usage.heapUsed > this.maxMemoryUsage) {
            console.warn('⚠️ Превышен лимит памяти, запускаем сборку мусора...');
            this.forceGarbageCollection();
        }
    }

    /**
     * Принудительная сборка мусора
     */
    forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            console.log('🗑️ Сборка мусора выполнена');
        } else {
            console.warn('⚠️ Сборка мусора недоступна. Запустите Node.js с флагом --expose-gc');
        }
    }

    /**
     * Получение информации о памяти
     */
    getMemoryInfo() {
        const usage = process.memoryUsage();
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024)
        };
    }

    /**
     * Увеличение счетчика обработанных элементов
     */
    increment() {
        // Простая реализация для совместимости
        this.checkMemoryUsage();
    }
}

// Создаем единственный экземпляр
const memoryManager = new MemoryManager();

module.exports = { memoryManager, MemoryManager };
