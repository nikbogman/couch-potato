import { Route, Routes } from "react-router";
import { PageMessage } from "./components/Status";
import { RemoteLayout } from "./layouts/RemoteLayout";
import { TvLayout } from "./layouts/TvLayout";
import { Navigation } from "./navigation/Navigation";
import { Home } from "./pages/Home";
import { Movie } from "./pages/Movie";
import { NowPlaying } from "./pages/NowPlaying";
import { Player } from "./pages/Player";
import { Search } from "./pages/Search";
import { Series } from "./pages/Series";
import { TvClient } from "./remote/TvClient";

export function App() {
  return (
    <>
      <TvClient />
      <Navigation />
      <Routes>
        {/* Phone remote: the same pages under /remote, so the phone never navigates to /watch. */}
        <Route path="/remote" element={<RemoteLayout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="now-playing" element={<NowPlaying />} />
          <Route path="movie/:id" element={<Movie />} />
          <Route path="tv/:id" element={<Series />} />
          <Route path="*" element={<PageMessage>Page not found.</PageMessage>} />
        </Route>
        <Route element={<TvLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/movie/:id" element={<Movie />} />
          <Route path="/tv/:id" element={<Series />} />
          <Route path="*" element={<PageMessage>Page not found.</PageMessage>} />
        </Route>
        <Route path="/watch/movie/:id" element={<Player kind="movie" />} />
        <Route path="/watch/tv/:id/:season/:episode" element={<Player kind="tv" />} />
      </Routes>
    </>
  );
}
