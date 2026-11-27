import { Route, Routes } from "react-router";
import { PageMessage } from "./components/Status";
import { RemoteLayout } from "./layouts/RemoteLayout";
import { TvLayout } from "./layouts/TvLayout";
import { Navigation } from "./navigation/Navigation";
import { Find } from "./pages/Find";
import { Home } from "./pages/Home";
import { Invite } from "./pages/Invite";
import { Lists } from "./pages/Lists";
import { Movie } from "./pages/Movie";
import { NowPlaying } from "./pages/NowPlaying";
import { PairTv } from "./pages/PairTv";
import { Player } from "./pages/Player";
import { Search } from "./pages/Search";
import { Series } from "./pages/Series";
import { Settings } from "./pages/Settings";
import { TvSettings } from "./pages/TvSettings";
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
          <Route path="find" element={<Find />} />
          <Route path="lists" element={<Lists />} />
          <Route path="now-playing" element={<NowPlaying />} />
          <Route path="movie/:id" element={<Movie />} />
          <Route path="tv/:id" element={<Series />} />
          <Route path="settings" element={<Settings />} />
          <Route path="pair" element={<PairTv />} />
          <Route path="invite" element={<Invite />} />
          <Route path="*" element={<PageMessage>Page not found.</PageMessage>} />
        </Route>
        <Route element={<TvLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/movie/:id" element={<Movie />} />
          <Route path="/tv/:id" element={<Series />} />
          <Route path="/settings" element={<TvSettings />} />
          <Route path="*" element={<PageMessage>Page not found.</PageMessage>} />
        </Route>
        <Route path="/watch/movie/:id" element={<Player kind="movie" />} />
        <Route path="/watch/tv/:id/:season/:episode" element={<Player kind="tv" />} />
      </Routes>
    </>
  );
}
