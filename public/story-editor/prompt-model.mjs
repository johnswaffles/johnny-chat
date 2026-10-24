// Resource ceiling, not a model-context guarantee. Never silently clip instructions.
export const MAX_PROMPT_BYTES=100000;
export function editorialPrompt(value){
 if(typeof value!=='string'||!value.trim())throw Object.assign(Error('Enter a nonempty editorial prompt.'),{status:400});
 if(new TextEncoder().encode(value).byteLength>MAX_PROMPT_BYTES)throw Object.assign(Error('This prompt exceeds the 100,000 UTF-8 byte safety limit. Nothing was shortened or saved. Reduce the prompt and try again.'),{status:413});
 return value;
}
export const PUBLICATION_POLISH=`Transform the entire supplied manuscript into a comprehensive, professionally polished, engaging publication. Read the whole work before planning changes. Preserve all meaningful details, explanations, examples, arguments, evidence, nuance, and conclusions. Do not shorten or summarize merely for brevity. Preserve depth and expand underdeveloped ideas with valuable context and explanation, without filler, redundant wording, or tangents.

Strengthen prose to a professional publishing standard: precise, natural, authoritative yet approachable, varied in rhythm, clear to an educated general audience, and free of generic AI phrases or unnecessary jargon. Build reader engagement through narrative progression, meaningful examples, smooth transitions, and explanations of why each idea matters. Distinguish repetition from depth; prefer complete explanations over compressed summaries or automatic bullet lists.

Plan a logical organization appropriate to this work: title and subtitle, introduction, chapters and subsections, progression of ideas, supporting examples, and an earned conclusion where appropriate. Recommend larger structural changes in the editorial notes when the passage-based workflow cannot implement them safely. Do not force the book to conclude early or invent missing source material.

For nonfiction, enrich the substance only with information supported by supplied or independently verified sources. Clearly distinguish established facts, interpretation, recommendations, and uncertainty. Cite credible research only when the source and the specific claim can actually be verified. Do not invent facts, quotations, statistics, references, links, citations, or research findings. This editing pipeline does not browse or independently verify external research: retain supported citations and flag research needs in editorial notes rather than pretending research occurred. For memoir, never invent the author's personal events, dialogue, motives, or experiences. For fiction, preserve voice, viewpoint, characters, plot, and ending unless the author explicitly requests a change.

Make the publication readable and cohesive using the headings, paragraphs, and DOCX export styles the app supports. Recommend tables, comparisons, illustrations, charts, callouts, typography, or page-design improvements when useful, but do not claim to have created unsupported graphics, layouts, headers, footers, or custom page designs. Respect the original manuscript and keep meaningful detail while making the finished work as substantial as its subject deserves.`;
