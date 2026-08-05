import { pipeline, env } from '@huggingface/transformers';
env.backends.onnx.allowNapiExecution = false;
async function run() {
  const generator = await pipeline('text-generation', 'onnx-community/SmolLM2-135M-Instruct-ONNX', { dtype: 'q4' });
  const prompt = `<|im_start|>system\nYou are an expert NPM package analyst. Provide a brief analysis of the package. Output ONLY a health score number (0-100) followed by a short verdict.<|im_end|>\n<|im_start|>user\nAnalyze: react, Desc: React is a JavaScript library for building user interfaces., Age: 3650 days, Deps: 2, Downloads: 1000000<|im_end|>\n<|im_start|>assistant\nScore: `;
  const output = await generator(prompt, { max_new_tokens: 50, temperature: 0.3, return_full_text: false });
  console.log("RAW OUTPUT:", JSON.stringify(output[0].generated_text));
}
run().catch(console.error);
