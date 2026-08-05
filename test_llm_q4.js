import { pipeline, env } from '@huggingface/transformers';

env.backends.onnx.allowNapiExecution = false;

async function run() {
  console.log("Loading pipeline q4...");
  const generator = await pipeline('text-generation', 'onnx-community/SmolLM2-135M-Instruct-ONNX', {
    dtype: 'q4',
    progress_callback: (x) => console.log('Progress:', x.file, x.status, x.total)
  });
  console.log("Pipeline loaded.");
}

run().catch(console.error);
