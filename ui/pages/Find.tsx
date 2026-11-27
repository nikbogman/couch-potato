import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { PageMessage } from "../components/Status";
import { searchTitles } from "../lib/api";
import { bestMatch } from "../lib/find";

/**
 * /remote/find?title=&year=&type=movie|tv: a deep link for other apps (unreel)
 * that know a title's name and year but not its TMDB id. Opens the matching
 * title page, or the search results when nothing clearly matches.
 */
export function Find() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const title = (params.get("title") ?? "").trim();
  const year = params.get("year");
  const type = params.get("type");
  const kind = type === "movie" || type === "tv" ? type : null;

  useEffect(() => {
    const search = `/remote/search?q=${encodeURIComponent(title)}`;
    if (!title) return void navigate("/remote", { replace: true });
    let live = true;
    searchTitles(title)
      .then((results) => {
        const hit = bestMatch(results, kind, year);
        if (live) navigate(hit ? `/remote/${hit.mediaType}/${hit.id}` : search, { replace: true });
      })
      .catch(() => live && navigate(search, { replace: true }));
    return () => {
      live = false;
    };
  }, [title, year, kind, navigate]);

  return <PageMessage>Finding {title || "it"}…</PageMessage>;
}
