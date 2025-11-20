// Implementing size checking before localStorage writes
function setItemWithSizeCheck(key, value) {
    try {
        // Convert value to string
        const stringValue = JSON.stringify(value);
        const currentSize = stringValue.length;
        const totalSize = localStorage.length;

        // Check the total size of localStorage
        if (currentSize + totalSize > 5 * 1024 * 1024) { // Assuming limit is 5MB
            console.error('QuotaExceededError: LocalStorage size limit exceeded.');
            return;
        }
        localStorage.setItem(key, stringValue);
    } catch (error) {
        console.error('Error setting item in localStorage:', error);
    }
}

// Usage
setItemWithSizeCheck('yourKey', { data: 'yourData' });