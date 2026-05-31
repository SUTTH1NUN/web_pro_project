document.addEventListener('DOMContentLoaded', () => {
    const testApiBtn = document.getElementById('testApiBtn');
    const apiResult = document.getElementById('apiResult');

    if (testApiBtn) {
        testApiBtn.addEventListener('click', async () => {
            try {
                // Test the users stats API route
                const response = await fetch('/api/users/123/stats');
                const data = await response.json();
                
                apiResult.style.display = 'block';
                apiResult.innerHTML = `
                    <h3 style="margin-bottom: 1rem;">API Response (GET /api/users/123/stats):</h3>
                    <pre style="text-align: left; background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 8px; overflow-x: auto;">
${JSON.stringify(data, null, 2)}
                    </pre>
                `;
            } catch (error) {
                console.error('Error calling API:', error);
                apiResult.style.display = 'block';
                apiResult.innerHTML = `<p style="color: red;">Error connecting to API. Is the server running?</p>`;
            }
        });
    }
});
