import { pipeline, env } from '@huggingface/transformers';

env.backends.onnx.allowNapiExecution = false;

async function run() {
  console.log("Loading pipeline...");
  const generator = await pipeline('text-generation', 'onnx-community/SmolLM2-135M-Instruct-ONNX', {
    progress_callback: (x) => console.log('Progress:', x)
  });
  console.log("Pipeline loaded. Generating...");
  const output = await generator("Hello, how are you?", { max_new_tokens: 10 });
  console.log("Output:", output);
}

run().catch(console.error);
