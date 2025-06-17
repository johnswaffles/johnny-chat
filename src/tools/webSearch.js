import wretch from "wretch";

export async function runWebSearch(q) {
  const json = await wretch("https://ddg-webapp-search.vercel.app/api/search")
    .query({ term: q, region: "wt-wt", safesearch: "Moderate", timelimit: "y" })
    .get()
    .json();

  return json.results
    .slice(0, 5)
    .map(r => `${r.title}\n${r.snippet}\n${r.url}`)
    .join("\n\n");
}
