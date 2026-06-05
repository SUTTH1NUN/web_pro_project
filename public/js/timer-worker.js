let timerId = null;

self.onmessage = function (e) {
    const data = e.data;
    
    if (data.command === 'start') {
        let timeLeft = data.timeLeft || 600;
        
        // Clear any existing timer
        if (timerId) clearInterval(timerId);
        
        // Start counting down every 1 second
        timerId = setInterval(() => {
            timeLeft--;
            self.postMessage({ type: 'tick', timeLeft: timeLeft });
            
            if (timeLeft <= 0) {
                clearInterval(timerId);
                self.postMessage({ type: 'end' });
            }
        }, 1000);
    } else if (data.command === 'stop') {
        if (timerId) clearInterval(timerId);
    }
};
