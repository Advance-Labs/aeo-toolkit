import type { JSX } from 'react';
import { GeneratorView } from '@/components/llms-txt/GeneratorView.js';

/**
 * llms.txt Generator tool. Re-homed from the standalone `llms-txt-generator` app.
 * The interactive view owns its own header + form; the shell provides the `<main>`.
 */
export default function LlmsTxtToolPage(): JSX.Element {
  return <GeneratorView />;
}
