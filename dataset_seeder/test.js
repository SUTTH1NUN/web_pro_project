require('dotenv').config();
const axios = require('axios');

async function test() {
    try {
        const res = await axios.post(
            "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli",
            { 
                inputs: "This is a simple test sentence.",
                parameters: { candidate_labels: ["A1", "A2", "B1", "B2", "C1", "C2"] }
            },
            {
                headers: { 
                    Authorization: `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log(res.data);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}
test();
