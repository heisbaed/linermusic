import { PairPage } from "./PairPage";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";

import {

  ArrowDown,

  ArrowRight,

  Check,

  ChevronDown,

  Download,

  FileCheck2,

  Heart,

  Headphones,

  Library,

  Menu,

  MoreHorizontal,

  Music2,

  Pause,

  Play,

  Repeat2,

  Search,

  ShieldCheck,

  Shuffle,

  SkipBack,

  SkipForward,

  Sparkles,

  Volume2,

  X,

} from "lucide-react";

import { useEffect, useState, type CSSProperties } from "react";



type Page = "home" | "experience" | "download" | "song" | "pair";



const ease = [0.22, 1, 0.36, 1] as const;

const APK_URL =

  "https://github.com/heisbaed/linermusic/releases/download/v0.1.6/Cine-Music-0.1.6.apk";

const APK_SHA256 = "cfa5bbbb4dd58bb6a85b3cba669d42a2b25cf75c6a1d9e37fa151fb4fd3a0e3f";
function usePerformanceMode() {

  const [liteMode, setLiteMode] = useState(false);



  useEffect(() => {

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const smallScreen = window.matchMedia("(max-width: 760px)");

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })

      .connection;

    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;



    const update = () => {

      setLiteMode(

        reducedMotion.matches ||

          Boolean(connection?.saveData) ||

          navigator.hardwareConcurrency <= 4 ||

          deviceMemory <= 4 ||

          smallScreen.matches,

      );

    };



    update();

    reducedMotion.addEventListener("change", update);

    smallScreen.addEventListener("change", update);

    return () => {

      reducedMotion.removeEventListener("change", update);

      smallScreen.removeEventListener("change", update);

    };

  }, []);



  return liteMode;

}



function Brand({ compact = false }: { compact?: boolean }) {

  return (

    <span className="brand">

      <img src="/assets/cine-music-logo.png" alt="" />

      {!compact && <span>Cine music</span>}

    </span>

  );

}



const tracks = [

  { title: "Velvet Morning", artist: "Arlo Grey", length: "3:48", tone: "rose" },

  { title: "After the Rain", artist: "Mira Vale", length: "4:12", tone: "sage" },

  { title: "Parallel Light", artist: "Cine Sessions", length: "3:36", tone: "lilac" },

];



function PlaybackPhone({ large = false }: { large?: boolean }) {

  const liteMode = usePerformanceMode();

  const [trackIndex, setTrackIndex] = useState(0);

  const [playing, setPlaying] = useState(true);

  const [progress, setProgress] = useState(34);

  const [view, setView] = useState<"player" | "queue">("player");

  const [liked, setLiked] = useState(false);

  const track = tracks[trackIndex];



  useEffect(() => {

    if (!playing) return;

    const timer = window.setInterval(

      () => {

        if (document.hidden) return;

        setProgress((value) => {

          if (value >= 99.5) {

            setTrackIndex((current) => (current + 1) % tracks.length);

            return 0;

          }

          return value + (liteMode ? 1.2 : 0.45);

        });

      },

      liteMode ? 480 : 180,

    );

    return () => window.clearInterval(timer);

  }, [liteMode, playing]);



  const changeTrack = (direction: number) => {

    setTrackIndex((current) => (current + direction + tracks.length) % tracks.length);

    setProgress(0);

    setPlaying(true);

  };



  return (

    <motion.div

      className={large ? "playback-stage is-large" : "playback-stage"}

      initial={liteMode ? false : { opacity: 0, y: 30, scale: 0.96 }}

      animate={{ opacity: 1, y: 0, scale: 1 }}

      transition={{ duration: 0.9, delay: 0.2, ease }}

    >

      <div className="playback-glow" />

      <motion.div

        className="real-phone"

        whileHover={liteMode ? undefined : { y: -5 }}

        transition={{ duration: 0.4, ease }}

      >

        <div className="phone-island" />

        <div className="real-screen">

          <div className="player-header">

            <button

              onClick={() => setView(view === "player" ? "queue" : "player")}

              aria-label="Switch player view"

            >

              <ChevronDown />

            </button>

            <div>

              <small>PLAYING FROM</small>

              <strong>Cine Selects</strong>

            </div>

            <button aria-label="More options">

              <MoreHorizontal />

            </button>

          </div>



          <AnimatePresence mode="wait">

            {view === "player" ? (

              <motion.div

                key={`player-${trackIndex}`}

                className="player-view"

                initial={{ opacity: 0, x: 24 }}

                animate={{ opacity: 1, x: 0 }}

                exit={{ opacity: 0, x: -24 }}

                transition={{ duration: 0.38, ease }}

              >

                <motion.div

                  className={`dynamic-art art-${track.tone} ${playing ? "is-playing" : ""}`}

                  animate={{ scale: playing ? 1 : 0.96 }}

                >

                  <div className="art-haze" />

                  <div className="record-ring ring-a" />

                  <div className="record-ring ring-b" />

                  <div className="record-core">

                    <span />

                  </div>

                  <div className="art-grain" />

                </motion.div>

                <div className="track-heading">

                  <div>

                    <h3>{track.title}</h3>

                    <p>{track.artist}</p>

                  </div>

                  <button

                    className={liked ? "liked" : ""}

                    onClick={() => setLiked(!liked)}

                    aria-label="Favorite track"

                  >

                    <Heart fill={liked ? "currentColor" : "none"} />

                  </button>

                </div>

                <label className="seek-bar">

                  <span className="sr-only">Playback position</span>

                  <input

                    type="range"

                    min="0"

                    max="100"

                    value={progress}

                    onChange={(event) => setProgress(Number(event.target.value))}

                    style={{ "--progress": `${progress}%` } as CSSProperties}

                  />

                  <span>

                    <i>1:24</i>

                    <i>{track.length}</i>

                  </span>

                </label>

                <div className="player-controls">

                  <button aria-label="Shuffle">

                    <Shuffle />

                  </button>

                  <button onClick={() => changeTrack(-1)} aria-label="Previous track">

                    <SkipBack fill="currentColor" />

                  </button>

                  <button

                    className="main-play"

                    onClick={() => setPlaying(!playing)}

                    aria-label={playing ? "Pause" : "Play"}

                  >

                    {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}

                  </button>

                  <button onClick={() => changeTrack(1)} aria-label="Next track">

                    <SkipForward fill="currentColor" />

                  </button>

                  <button aria-label="Repeat">

                    <Repeat2 />

                  </button>

                </div>

                <div className="volume-row">

                  <Volume2 />

                  <span>

                    <i />

                  </span>

                  <button onClick={() => setView("queue")}>Up next</button>

                </div>

              </motion.div>

            ) : (

              <motion.div

                key="queue"

                className="queue-view"

                initial={{ opacity: 0, x: -24 }}

                animate={{ opacity: 1, x: 0 }}

                exit={{ opacity: 0, x: 24 }}

                transition={{ duration: 0.38, ease }}

              >

                <div className={`queue-current art-${track.tone}`}>

                  <div className="record-core">

                    <span />

                  </div>

                </div>

                <small>UP NEXT</small>

                <h3>Continue the feeling.</h3>

                <div className="queue-list">

                  {tracks.map((item, index) => (

                    <button

                      key={item.title}

                      className={index === trackIndex ? "current" : ""}

                      onClick={() => {

                        setTrackIndex(index);

                        setProgress(0);

                        setView("player");

                      }}

                    >

                      <span className={`queue-thumb art-${item.tone}`} />

                      <span>

                        <strong>{item.title}</strong>

                        <small>{item.artist}</small>

                      </span>

                      <i>{index === trackIndex && playing ? "Playing" : item.length}</i>

                    </button>

                  ))}

                </div>

                <button className="back-to-player" onClick={() => setView("player")}>

                  Back to player <ArrowRight />

                </button>

              </motion.div>

            )}

          </AnimatePresence>

        </div>

      </motion.div>

      <motion.div

        className="playback-badge quality-badge"

        animate={liteMode ? undefined : { y: [0, -6, 0] }}

        transition={liteMode ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}

      >

        <span className="live-dot" />

        <span>Lossless</span>

        <strong>24-bit / 96 kHz</strong>

      </motion.div>

      <motion.div

        className="playback-badge lyric-badge"

        animate={liteMode ? undefined : { y: [0, 7, 0] }}

        transition={liteMode ? undefined : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }}

      >

        <Music2 />

        <div>

          <strong>Live lyrics</strong>

          <span>Follow every word</span>

        </div>

      </motion.div>

    </motion.div>

  );

}



function Header({

  page,

  navigate,

}: {

  page: Page;

  navigate: (page: Page, section?: string) => void;

}) {

  const [open, setOpen] = useState(false);



  const go = (next: Page) => {

    navigate(next);

    setOpen(false);

  };



  return (

    <header className="site-header">

      <button className="brand-button" onClick={() => go("home")} aria-label="Go to home">

        <Brand />

      </button>

      <nav className={open ? "nav-links is-open" : "nav-links"} aria-label="Main navigation">

        <button className={page === "home" ? "active" : ""} onClick={() => go("home")}>

          Home

        </button>

        <button className={page === "experience" ? "active" : ""} onClick={() => go("experience")}>

          Experience

        </button>

        <button className={page === "download" ? "active" : ""} onClick={() => go("download")}>

          Download

        </button>

        <button

          onClick={() => {

            navigate("download", "faq");

            setOpen(false);

          }}

        >

          FAQ

        </button>

      </nav>

      <button className="header-cta" onClick={() => go("download")}>

        Get the APK <ArrowRight size={15} />

      </button>

      <button

        className="menu-button"

        onClick={() => setOpen(!open)}

        aria-label={open ? "Close menu" : "Open menu"}

      >

        {open ? <X /> : <Menu />}

      </button>

    </header>

  );

}



const reveal = {

  initial: { opacity: 0, y: 28 },

  whileInView: { opacity: 1, y: 0 },

  viewport: { once: true, margin: "-80px" },

  transition: { duration: 0.75, ease },

};



function AppScreen() {

  return (

    <div className="glass-phone-wrap">

      <motion.div className="glass-phone" {...reveal}>

        <div className="glass-screen">

          <div className="app-topbar">

            <Brand compact />

            <span>Good morning</span>

            <span className="avatar">CM</span>

          </div>

          <div className="app-copy">

            <small>MADE FOR YOU</small>

            <h3>

              Your day,

              <br />

              in sound.

            </h3>

          </div>

          <div className="app-featured">

            <span className="orb orb-one" />

            <span className="orb orb-two" />

            <div>

              <small>CINE SELECTS</small>

              <strong>Cloudline</strong>

              <span>18 tracks · 58 min</span>

            </div>

            <button aria-label="Play Cloudline">

              <Play size={16} fill="currentColor" />

            </button>

          </div>

          <p className="app-label">Recently played</p>

          <div className="album-row">

            {["Porcelain", "Slow bloom", "Daylight"].map((name, i) => (

              <div className="album" key={name}>

                <div className={`album-art art-${i + 1}`}>

                  <span />

                </div>

                <strong>{name}</strong>

                <small>Cine Sessions</small>

              </div>

            ))}

          </div>

          <div className="app-player">

            <div className="player-art">

              <span />

            </div>

            <div>

              <strong>Quiet hours</strong>

              <small>Elio North</small>

            </div>

            <button aria-label="Pause">

              <Pause size={15} fill="currentColor" />

            </button>

          </div>

          <div className="app-tabs">

            <span className="selected">

              <Music2 />

              Home

            </span>

            <span>

              <Search />

              Search

            </span>

            <span>

              <Sparkles />

              Explore

            </span>

            <span>

              <Library />

              Library

            </span>

          </div>

        </div>

      </motion.div>

      <div className="glass-orbit orbit-one" />

      <div className="glass-orbit orbit-two" />

    </div>

  );

}



function StaticPhoneShowcase() {

  const discoveryCards = [

    ["Slow bloom", "art-rose"],

    ["Daylight", "art-sage"],

    ["Porcelain", "art-lilac"],

  ];



  return (

    <motion.div

      className="dual-phone-stage"

      initial={{ opacity: 0, y: 28 }}

      animate={{ opacity: 1, y: 0 }}

      transition={{ duration: 0.9, delay: 0.2, ease }}

      aria-label="Cine music home and personalized mix screens"

    >

      <div className="dual-phone-light" />



      <motion.div

        className="static-app-phone discovery-phone"

        initial={{ opacity: 0, x: -24, rotate: -8 }}

        animate={{ opacity: 1, x: 0, rotate: -4 }}

        transition={{ duration: 0.9, delay: 0.3, ease }}

      >

        <div className="static-island" />

        <div className="static-screen">

          <div className="static-topbar">

            <Brand compact />

            <span>Good morning</span>

            <i>CM</i>

          </div>

          <div className="static-welcome">

            <small>MADE FOR YOU</small>

            <h3>

              Your day,

              <br />

              in sound.

            </h3>

          </div>

          <div className="static-feature">

            <div className="feature-orb">

              <span />

            </div>

            <div>

              <small>CINE SELECTS</small>

              <strong>Cloudline</strong>

              <span>18 tracks · 58 min</span>

            </div>

            <span className="static-play">

              <Play fill="currentColor" />

            </span>

          </div>

          <div className="static-row-title">

            <strong>Recently played</strong>

            <span>See all</span>

          </div>

          <div className="static-albums">

            {discoveryCards.map(([title, tone]) => (

              <div key={title}>

                <span className={tone}>

                  <i />

                </span>

                <strong>{title}</strong>

                <small>Cine Sessions</small>

              </div>

            ))}

          </div>

          <div className="static-mini-player">

            <span className="art-rose">

              <i />

            </span>

            <div>

              <strong>Velvet Morning</strong>

              <small>Arlo Grey</small>

            </div>

            <Pause fill="currentColor" />

          </div>

          <div className="static-tabs">

            <span className="selected">

              <Music2 />

              Home

            </span>

            <span>

              <Search />

              Search

            </span>

            <span>

              <Sparkles />

              Explore

            </span>

            <span>

              <Library />

              Library

            </span>

          </div>

        </div>

      </motion.div>



      <motion.div

        className="static-app-phone mix-phone"

        initial={{ opacity: 0, x: 30, rotate: 8 }}

        animate={{ opacity: 1, x: 0, rotate: 3 }}

        transition={{ duration: 0.95, delay: 0.42, ease }}

      >

        <div className="static-island" />

        <div className="static-screen mix-screen">

          <div className="mix-topbar">

            <span>

              <ChevronDown />

            </span>

            <div>

              <small>YOUR DAILY SCENE</small>

              <strong>For you</strong>

            </div>

            <span>

              <MoreHorizontal />

            </span>

          </div>

          <div className="scene-art">

            <span className="scene-sun" />

            <span className="scene-glass glass-one" />

            <span className="scene-glass glass-two" />

            <div className="scene-lines">

              {Array.from({ length: 7 }).map((_, index) => (

                <i key={index} />

              ))}

            </div>

            <div className="scene-caption">

              <small>A CINEMATIC MIX</small>

              <strong>

                Quiet

                <br />

                Horizons

              </strong>

            </div>

          </div>

          <div className="mix-copy">

            <div>

              <small>CURATED FOR THIS MOMENT</small>

              <h3>Stay a little longer.</h3>

              <p>Soft focus, warm light and songs that leave room to breathe.</p>

            </div>

            <span className="static-play">

              <Play fill="currentColor" />

            </span>

          </div>

          <div className="mood-chips">

            <span>Ambient</span>

            <span>Indie</span>

            <span>Slow</span>

          </div>

          <div className="mix-next">

            <small>UP NEXT</small>

            <div>

              <span className="art-sage">

                <i />

              </span>

              <p>

                <strong>After the Rain</strong>

                <small>Mira Vale</small>

              </p>

              <i>4:12</i>

            </div>

          </div>

        </div>

      </motion.div>



      <div className="static-note note-discover">

        <Sparkles />

        <span>

          <strong>Made for you</strong>

          <small>Every listen gets more personal</small>

        </span>

      </div>

      <div className="static-note note-library">

        <Library />

        <span>

          <strong>Your music</strong>

          <small>Always one touch away</small>

        </span>

      </div>

    </motion.div>

  );

}



function HomePage({ navigate }: { navigate: (page: Page, section?: string) => void }) {

  const { scrollYProgress } = useScroll();

  const orbY = useTransform(scrollYProgress, [0, 1], [0, 180]);



  return (

    <main>

      <section className="hero">

        <motion.div className="ambient ambient-a" style={{ y: orbY }} />

        <div className="hero-copy">

          <motion.div

            initial={{ opacity: 0, y: 12 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.65 }}

            className="eyebrow"

          >

            <span /> CINE MUSIC FOR ANDROID

          </motion.div>

          <motion.h1

            initial={{ opacity: 0, y: 24 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.85, delay: 0.08, ease }}

          >

            Music,

            <br />

            made to <em>feel.</em>

          </motion.h1>

          <motion.p

            initial={{ opacity: 0, y: 20 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.75, delay: 0.18, ease }}

          >

            A quieter, more beautiful way to listen. Cine music brings discovery, playback and your

            library together in one fluid space.

          </motion.p>

          <motion.div

            className="hero-actions"

            initial={{ opacity: 0, y: 18 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.7, delay: 0.28, ease }}

          >

            <button className="button primary" onClick={() => navigate("download")}>

              View download <ArrowRight />

            </button>

            <button className="button secondary" onClick={() => navigate("experience")}>

              Explore the app <ArrowDown />

            </button>

          </motion.div>

          <motion.div

            className="release-note"

            initial={{ opacity: 0 }}

            animate={{ opacity: 1 }}

            transition={{ delay: 0.5 }}

          >

            <span /> Android APK v0.1.6 · Available now

          </motion.div>

        </div>

        <StaticPhoneShowcase />

        <div className="hero-footnote">

          <span>01</span>

          <p>Liquid clarity, effortless listening.</p>

          <span className="scroll-cue">

            SCROLL TO DISCOVER <ArrowDown size={13} />

          </span>

        </div>

      </section>



      <section className="intro section-shell" id="experience">

        <motion.div {...reveal} className="section-heading">

          <span className="kicker">THE EXPERIENCE</span>

          <h2>

            Everything you need.

            <br />

            <span>Nothing you don’t.</span>

          </h2>

        </motion.div>

        <motion.p {...reveal} className="section-lede">

          Built around the way listening should feel: intuitive, personal and quietly alive.

        </motion.p>

        <div className="feature-grid">

          {[

            {

              icon: <Sparkles />,

              n: "01",

              title: "Discover naturally.",

              copy: "Thoughtful recommendations meet a calm, open interface that lets curiosity lead.",

            },

            {

              icon: <Headphones />,

              n: "02",

              title: "Listen without friction.",

              copy: "A focused player, instant controls and smooth transitions keep you in the moment.",

            },

            {

              icon: <Library />,

              n: "03",

              title: "Keep it close.",

              copy: "Favorites, history and your personal library stay organized and always within reach.",

            },

          ].map((feature, index) => (

            <motion.article

              {...reveal}

              transition={{ duration: 0.7, delay: index * 0.08, ease }}

              className="feature-card"

              key={feature.n}

            >

              <div>

                {feature.icon}

                <span>{feature.n}</span>

              </div>

              <h3>{feature.title}</h3>

              <p>{feature.copy}</p>

            </motion.article>

          ))}

        </div>

      </section>



      <section className="showcase section-shell">

        <AppScreen />

        <motion.div {...reveal} className="showcase-copy">

          <span className="kicker">DESIGNED TO DISAPPEAR</span>

          <h2>

            Less interface.

            <br />

            <span>More music.</span>

          </h2>

          <p>

            Soft translucency, responsive depth and refined motion give every screen a sense of

            place without getting in your way.

          </p>

          <div className="detail-list">

            {[

              [

                "01",

                "Liquid, not loud",

                "Light bends through layers while content remains crisp and easy to read.",

              ],

              [

                "02",

                "Motion with meaning",

                "Transitions show where you are going—never movement for movement’s sake.",

              ],

              [

                "03",

                "One continuous flow",

                "Move from discovery to playback and your library without breaking the rhythm.",

              ],

            ].map(([n, title, copy]) => (

              <div className="detail" key={n}>

                <span>{n}</span>

                <div>

                  <strong>{title}</strong>

                  <p>{copy}</p>

                </div>

              </div>

            ))}

          </div>

        </motion.div>

      </section>



      <section className="closing section-shell">

        <motion.div {...reveal} className="closing-card">

          <img src="/assets/cine-music-logo.png" alt="" />

          <div>

            <span className="kicker">YOUR NEXT FEELING</span>

            <h2>

              A whole world

              <br />

              in your headphones.

            </h2>

          </div>

          <button className="button primary" onClick={() => navigate("download")}>

            APK information <ArrowRight />

          </button>

        </motion.div>

      </section>

    </main>

  );

}



function AnimatedWords({ children }: { children: string }) {

  return (

    <span className="animated-words" aria-label={children}>

      {children.split(" ").map((word, index) => (

        <motion.span

          aria-hidden="true"

          key={`${word}-${index}`}

          initial={{ y: "115%", rotate: 3 }}

          whileInView={{ y: 0, rotate: 0 }}

          viewport={{ once: true }}

          transition={{ duration: 0.75, delay: index * 0.055, ease }}

        >

          {word}&nbsp;

        </motion.span>

      ))}

    </span>

  );

}



function ExperiencePage({ navigate }: { navigate: (page: Page, section?: string) => void }) {

  const liteMode = usePerformanceMode();

  const { scrollYProgress } = useScroll();

  const phoneY = useTransform(scrollYProgress, [0, 0.75], [0, 120]);

  const copyY = useTransform(scrollYProgress, [0, 0.5], [0, -45]);



  return (

    <main className="experience-page">

      <section className="experience-hero section-shell">

        <motion.div className="experience-copy" style={{ y: copyY }}>

          <div className="eyebrow">

            <span /> INSIDE CINE MUSIC

          </div>

          <h1>

            <AnimatedWords>Playback that feels alive.</AnimatedWords>

          </h1>

          <p>

            Not a render. Not a looping mockup. Try the player—change tracks, drag the timeline,

            open the queue and shape the session yourself.

          </p>

          <div className="experience-actions">

            <button

              className="button primary"

              onClick={() =>

                document.querySelector("#player-story")?.scrollIntoView({ behavior: "smooth" })

              }

            >

              Explore the player <ArrowDown />

            </button>

            <button className="button secondary" onClick={() => navigate("download")}>

              APK details <ArrowRight />

            </button>

          </div>

        </motion.div>

        <motion.div style={{ y: phoneY }} className="experience-phone">

          <PlaybackPhone large />

        </motion.div>

      </section>



      <section className="marquee-strip" aria-hidden="true">

        <motion.div

          animate={liteMode ? undefined : { x: ["0%", "-50%"] }}

          transition={liteMode ? undefined : { duration: 24, repeat: Infinity, ease: "linear" }}

        >

          <span>LOSSLESS PLAYBACK</span>

          <i />

          <span>LIVE LYRICS</span>

          <i />

          <span>LIQUID MOTION</span>

          <i />

          <span>YOUR LIBRARY</span>

          <i />

          <span>LOSSLESS PLAYBACK</span>

          <i />

          <span>LIVE LYRICS</span>

          <i />

          <span>LIQUID MOTION</span>

          <i />

          <span>YOUR LIBRARY</span>

          <i />

        </motion.div>

      </section>



      <section className="player-story section-shell" id="player-story">

        <motion.div {...reveal} className="story-heading">

          <span className="kicker">BUILT AROUND THE MOMENT</span>

          <h2>

            <AnimatedWords>Every control, right where it belongs.</AnimatedWords>

          </h2>

        </motion.div>

        <div className="story-grid">

          {[

            [

              "01",

              "The player stays focused",

              "Track, artist, timeline and essential controls. Everything else waits until you ask for it.",

            ],

            [

              "02",

              "The queue stays close",

              "Move between now playing and what comes next without losing the current session.",

            ],

            [

              "03",

              "Motion carries context",

              "Artwork, titles and controls transition together so every change feels continuous.",

            ],

            [

              "04",

              "Your taste leads",

              "Favorites and recent listening become the starting point for what Cine music plays next.",

            ],

          ].map(([number, title, copy], index) => (

            <motion.article

              key={number}

              initial={{ opacity: 0, y: 35 }}

              whileInView={{ opacity: 1, y: 0 }}

              viewport={{ once: true, margin: "-70px" }}

              transition={{ duration: 0.7, delay: index * 0.08, ease }}

            >

              <span>{number}</span>

              <h3>{title}</h3>

              <p>{copy}</p>

            </motion.article>

          ))}

        </div>

      </section>



      <section className="motion-statement">

        <div className="section-shell">

          <motion.span

            initial={{ width: 0 }}

            whileInView={{ width: 54 }}

            viewport={{ once: true }}

            transition={{ duration: 0.7, ease }}

          />

          <motion.h2

            initial={{ opacity: 0 }}

            whileInView={{ opacity: 1 }}

            viewport={{ once: true }}

            transition={{ duration: 1 }}

          >

            Designed to move

            <br />

            at the speed of <em>feeling.</em>

          </motion.h2>

          <motion.button

            {...reveal}

            className="button primary"

            onClick={() => navigate("download")}

          >

            View release information <ArrowRight />

          </motion.button>

        </div>

      </section>

    </main>

  );

}



const faqs = [

  [

    "Can I download Cine music right now?",

    "Yes. Cine music v0.1.6 is available from the official GitHub release linked on this page. The current file is a debug-signed testing build.",

  ],

  ["Which Android versions will be supported?", "Cine music v0.1.6 requires Android 8.0 or newer."],

  [

    "What is an APK?",

    "An APK is an Android application package. It allows an app to be installed directly after you review its source, compatibility and permissions.",

  ],

  [

    "How do I know the file is authentic?",

    `Download only from the official GitHub release and compare its SHA-256 checksum with ${APK_SHA256}. Keep Google Play Protect enabled.`,

  ],

];





function SongLinkPage({ songId }: { songId?: string }) {

  const appUrl = songId ? `cinemusic://song/${songId}` : "cinemusic://";

  return (

    <main className="download-page">

      <section className="download-hero section-shell">

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>

          <div className="eyebrow"><span /> CINE MUSIC / SONG</div>

          <h1>Open this song<br />in <em>Cine Music.</em></h1>

          <p>{songId ? "If you have Cine Music installed, open it to play this song. Otherwise, download the app first." : "Open Cine Music to continue."}</p>

          <div className="hero-actions" style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>

            <a className="button primary" href={appUrl}>Open in app <ArrowRight /></a>

            <a className="button secondary" href={APK_URL}>Download app <Download /></a>

          </div>

        </motion.div>

        <motion.div className="package-orb" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease }}>

          <div className="orb-halo" />

          <img src="/assets/cine-music-logo.png" alt="Cine music" />

        </motion.div>

      </section>

    </main>

  );

}



function DownloadPage() {

  const [openFaq, setOpenFaq] = useState(0);



  return (

    <main className="download-page">

      <section className="download-hero section-shell">

        <motion.div

          initial={{ opacity: 0, y: 24 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.8, ease }}

        >

          <div className="eyebrow">

            <span /> CINE MUSIC / ANDROID

          </div>

          <h1>

            Your next listen

            <br />

            starts <em>here.</em>

          </h1>

          <p>

            Get release details, compatibility information and the official Cine music APK—all in

            one place.

          </p>

        </motion.div>

        <motion.div

          className="package-orb"

          initial={{ opacity: 0, scale: 0.85 }}

          animate={{ opacity: 1, scale: 1 }}

          transition={{ duration: 1, ease }}

        >

          <div className="orb-halo" />

          <img src="/assets/cine-music-logo.png" alt="Cine music" />

        </motion.div>

      </section>



      <section className="package-section section-shell" id="package">

        <motion.div {...reveal} className="package-card">

          <div className="package-main">

            <div className="package-title">

              <img src="/assets/cine-music-logo.png" alt="" />

              <div>

                <small>ANDROID APPLICATION</small>

                <h2>Cine music</h2>

              </div>

              <span className="status-pill">

                <i /> Available now

              </span>

            </div>

            <p>

              Cine music v0.1.6 brings streaming, background playback, offline downloads, search,

              playlists, synced lyrics, a refreshed dark-green identity and cloud sync to Android 8.0 and newer.

            </p>

            <a className="button primary download-ready" href={APK_URL}>

              <Download /> Download Cine music

            </a>

            <span className="availability">v0.1.6 · 12.30 MB · Android 8.0+</span>

          </div>

          <div className="package-info">

            <div className="info-heading">

              <h3>Package information</h3>

              <FileCheck2 />

            </div>

            <dl>

              <div>

                <dt>Version</dt>

                <dd>0.1.6</dd>

              </div>

              <div>

                <dt>File size</dt>

                <dd>12.30 MB</dd>

              </div>

              <div>

                <dt>Android</dt>

                <dd>8.0 or newer</dd>

              </div>

              <div>

                <dt>Release date</dt>

                <dd>10 November 2026</dd>

              </div>

              <div>

                <dt>Package name</dt>

                <dd>com.heisbaed.cinemusic</dd>

              </div>

              <div>

                <dt>SHA-256</dt>

                <dd className="checksum">{APK_SHA256}</dd>

              </div>

            </dl>

            <div className="safety-note">

              <ShieldCheck />

              <p>

                This is a debug-signed testing build, not a Play Store release. Verify the checksum

                before installing and never bypass a device security warning.

              </p>

            </div>

          </div>

        </motion.div>

      </section>



      <section className="release-highlights section-shell">

        <motion.div {...reveal} className="section-heading">

          <span className="kicker">WHAT’S IN V0.1.6</span>

          <h2>

            Ready for your

            <br />

            <span>everyday listening.</span>

          </h2>

        </motion.div>

        <div className="release-grid">

          {[

            ["Playback", "Streaming, background audio and media notification controls."],

            ["Offline", "Downloads with automatic retry and an encrypted offline vault."],

            ["Discovery", "Home shelves, release spotlights, categories, search and Explore."],

            ["Your library", "Albums, artists, playlists, favorites, queue and playlist import."],

            ["Listening tools", "Synced lyrics, sleep timer, shuffle and repeat controls."],

            ["Cloud sync", "Email or Google sign-in with Firebase-powered synchronization."],

          ].map(([title, copy], index) => (

            <motion.article

              {...reveal}

              transition={{ duration: 0.65, delay: index * 0.05, ease }}

              key={title}

            >

              <span>{String(index + 1).padStart(2, "0")}</span>

              <h3>{title}</h3>

              <p>{copy}</p>

            </motion.article>

          ))}

        </div>

      </section>



      <section className="install section-shell">

        <motion.div {...reveal} className="section-heading">

          <span className="kicker">INSTALLATION GUIDE</span>

          <h2>

            From download

            <br />

            <span>to first play.</span>

          </h2>

        </motion.div>

        <div className="steps-grid">

          {[

            [

              "01",

              "Download the official file",

              "Use only the release link on this page. Confirm the version and checksum.",

            ],

            [

              "02",

              "Allow this source",

              "If prompted, permit your browser or file manager to install this one app.",

            ],

            [

              "03",

              "Review, then install",

              "Check the app name and permissions. Stop if anything appears unexpected.",

            ],

            [

              "04",

              "Open and listen",

              "Launch Cine music, then turn off “Allow from this source” again.",

            ],

          ].map(([n, title, copy], index) => (

            <motion.article

              {...reveal}

              transition={{ duration: 0.65, delay: index * 0.06, ease }}

              className="step"

              key={n}

            >

              <span>{n}</span>

              <Check />

              <h3>{title}</h3>

              <p>{copy}</p>

            </motion.article>

          ))}

        </div>

      </section>



      <section className="faq section-shell" id="faq">

        <motion.div {...reveal} className="faq-intro">

          <span className="kicker">GOOD TO KNOW</span>

          <h2>

            A few things,

            <br />

            <span>before you play.</span>

          </h2>

          <p>The essentials about Cine music, APK files and getting started safely.</p>

        </motion.div>

        <motion.div {...reveal} className="faq-list">

          {faqs.map(([question, answer], index) => (

            <div className={openFaq === index ? "faq-item open" : "faq-item"} key={question}>

              <button

                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}

                aria-expanded={openFaq === index}

              >

                <span>{question}</span>

                <ChevronDown />

              </button>

              <div className="faq-answer">

                <p>{answer}</p>

              </div>

            </div>

          ))}

        </motion.div>

      </section>

    </main>

  );

}



function Footer({ navigate }: { navigate: (page: Page, section?: string) => void }) {

  return (

    <footer className="footer section-shell">

      <div className="footer-top">

        <Brand />

        <div>

          <button onClick={() => navigate("home")}>Home</button>

          <button onClick={() => navigate("experience")}>Experience</button>

          <button onClick={() => navigate("download")}>APK information</button>

          <button onClick={() => navigate("download", "faq")}>FAQ</button>

        </div>

      </div>

      <div className="footer-bottom">

        <span>Cine music. Hear beyond the ordinary.</span>

        <span>Developed by Osborne's Digital Solutions · <a href="mailto:osbornesecards@gmail.com">osbornesecards@gmail.com</a></span>

        <span>Android APK v0.1.6 · Available now</span>

      </div>

    </footer>

  );

}



function MobileAction() {

  return (

    <div className="mobile-action">

      <div>

        <span className="live-dot" />

        <p>

          <strong>Cine music for Android</strong>

          <small>v0.1.6 · 12.30 MB</small>

        </p>

      </div>

      <a href={APK_URL}>

        Download <Download />

      </a>

    </div>

  );

}



export default function App() {

  const liteMode = usePerformanceMode();

  const getLocation = () => {

    const p = window.location.pathname || "/";

    const song = p.match(/^\/song\/([A-Za-z0-9_-]{5,64})\/?$/);

    if (song) return { page: "song" as Page, section: undefined, songId: song[1] };

    if (/^\/download\/?$/.test(p)) return { page: "download" as Page, section: undefined, songId: undefined };

    if (/^\/(pair|tv-connect)\/?$/.test(p)) return { page: "pair" as Page, section: undefined, songId: undefined };

    const [pageName, section] = window.location.hash.replace("#", "").split("/");

    const nextPage: Page = pageName === "download" || pageName === "experience" ? pageName : "home";

    return { page: nextPage, section, songId: undefined };

  };

  const initialLocation = getLocation();

  const [page, setPage] = useState<Page>(initialLocation.page);

  const [targetSection, setTargetSection] = useState<string | undefined>(initialLocation.section);

  const [songId, setSongId] = useState<string | undefined>(initialLocation.songId);



  useEffect(() => {

    const onLocationChange = () => {

      const location = getLocation();

      setPage(location.page);

      setTargetSection(location.section);

      setSongId(location.songId);

    };

    window.addEventListener("popstate", onLocationChange);

    return () => window.removeEventListener("popstate", onLocationChange);

  }, []);



  useEffect(() => {

    const frame = requestAnimationFrame(() => {

      if (targetSection) {

        document.getElementById(targetSection)?.scrollIntoView({ behavior: "smooth" });

      } else {

        window.scrollTo({ top: 0 });

      }

    });

    return () => cancelAnimationFrame(frame);

  }, [page, targetSection]);



  const navigate = (next: Page, section?: string) => {

    const hash = `#${next === "song" ? "home" : next}${section ? `/${section}` : ""}`;

    window.history.pushState({}, "", hash);

    setPage(next === "song" ? "home" : next);

    setTargetSection(section);

    setSongId(undefined);

  };



  return (

    <div className={liteMode ? "app is-lite" : "app"}>

      <Header page={page} navigate={navigate} />

      {page === "home" && <HomePage navigate={navigate} />}

      {page === "experience" && <ExperiencePage navigate={navigate} />}

      {page === "download" && <DownloadPage />}

      {page === "pair" && <PairPage />}

      {page === "song" && <SongLinkPage songId={songId} />}

      <Footer navigate={navigate} />

      <MobileAction />

    </div>

  );

}

