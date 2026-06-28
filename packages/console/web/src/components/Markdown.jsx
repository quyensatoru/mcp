import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Markdown renderer for agent chat output. react-markdown renders to real React
// nodes (no dangerouslySetInnerHTML → XSS-safe); remark-gfm adds tables, task
// lists, strikethrough, autolinks. Styling lives under `.md` in ide.css.
const COMPONENTS = {
    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
};

export default function Markdown({ text }) {
    return (
        <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
                {text || ''}
            </ReactMarkdown>
        </div>
    );
}
