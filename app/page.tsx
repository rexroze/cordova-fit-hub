import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Dumbbell,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import "./landing.css";

const notes = [
  {
    number: "01",
    title: "Membership, made clear",
    copy: "See your plan and renewal date in one place, without chasing paper records.",
    icon: Dumbbell,
  },
  {
    number: "02",
    title: "A quicker hello at the door",
    copy: "Keep your member QR ready for staff check-in, with a member-code fallback.",
    icon: QrCode,
  },
  {
    number: "03",
    title: "Your account, in your hands",
    copy: "Review your own membership, visit history, and recorded payments after sign-in.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-header">
        <Link
          className="landing-brand"
          href="/"
          aria-label="Cordova Fit Hub home"
        >
          <span className="landing-brand-mark">
            <Dumbbell size={19} strokeWidth={2.2} />
          </span>
          <span className="landing-brand-name">
            CORDOVA <b>FIT HUB</b>
          </span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#your-hub">Your hub</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <Link className="landing-signin" href="/login">
          Sign in <ArrowUpRight size={16} />
        </Link>
      </header>

      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker">
            <span /> YOUR TRAINING, YOUR PACE
          </p>
          <h1 id="hero-title">
            A stronger
            <br />
            day starts <i>here.</i>
          </h1>
          <p className="landing-intro">
            Your Cordova Fit Hub account brings membership details, check-ins,
            and payment records together—so it’s easier to stay focused on
            showing up.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-cta" href="/login">
              Member sign in <ArrowRight size={17} />
            </Link>
            <span>Already part of the gym? Start here.</span>
          </div>
          <div className="landing-index">
            <span>01</span>
            <span className="landing-index-rule" />
            <span>THE MEMBER EXPERIENCE</span>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-image-frame">
            <Image
              src="/images/hero-training.jpg"
              alt="Gym training equipment, shown as illustrative stock photography"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 54vw"
              className="landing-hero-image"
            />
            <div className="landing-image-shade" />
            <div className="landing-photo-label">
              <span>THE DAILY PRACTICE</span>
              <b>
                Make room
                <br />
                for your next rep.
              </b>
            </div>
            <span className="landing-image-index">FITNESS / 001</span>
          </div>
          <div className="landing-stamp" aria-hidden="true">
            <span>SHOW UP</span>
            <ArrowDownRight size={19} />
            <span>MOVE FORWARD</span>
          </div>
          <div className="landing-orbit" aria-hidden="true" />
        </div>
      </section>

      <section
        className="landing-marquee"
        aria-label="Cordova Fit Hub member services"
      >
        <span>MEMBERSHIP</span>
        <i>✳</i>
        <span>ATTENDANCE</span>
        <i>✳</i>
        <span>YOUR ACCOUNT</span>
        <i>✳</i>
        <span>CORDOVA FIT HUB</span>
      </section>

      <section className="landing-hub" id="your-hub">
        <div className="landing-hub-heading">
          <p className="landing-kicker">
            <span /> ONE PLACE TO PICK UP WHERE YOU LEFT OFF
          </p>
          <h2>
            Less admin.
            <br />
            <i>More in it.</i>
          </h2>
          <p>
            Keep the useful details close. Your member portal gives you a clear
            view of your membership and the records attached to your account.
          </p>
          <Link className="landing-text-link" href="/login">
            Open your member account <ArrowRight size={16} />
          </Link>
        </div>
        <div className="landing-hub-photo">
          <Image
            src="/images/training-moment.jpg"
            alt="A person preparing for a workout, shown as illustrative stock photography"
            fill
            sizes="(max-width: 760px) 100vw, 45vw"
            className="landing-secondary-image"
          />
          <div className="landing-photo-caption">
            <span>YOUR ROUTINE, YOUR RECORD</span>
            <span>MEMBER PORTAL / 02</span>
          </div>
        </div>
        <div className="landing-hub-note">
          <span className="landing-note-mark">↗</span>
          <p>
            One account for your membership details, attendance history, and
            payment records.
          </p>
        </div>
      </section>

      <section className="landing-steps" id="how-it-works">
        <div className="landing-steps-heading">
          <p className="landing-kicker">
            <span /> MADE FOR THE EVERYDAY
          </p>
          <h2>
            Everything you need
            <br />
            to <i>keep moving.</i>
          </h2>
        </div>
        <div className="landing-step-list">
          {notes.map(({ number, title, copy, icon: Icon }) => (
            <article className="landing-step" key={number}>
              <span className="landing-step-number">{number}</span>
              <span className="landing-step-icon">
                <Icon size={20} strokeWidth={1.7} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
              <ArrowUpRight
                className="landing-step-arrow"
                size={18}
                aria-hidden="true"
              />
            </article>
          ))}
        </div>
      </section>

      <section className="landing-last-call">
        <div>
          <p className="landing-kicker">
            <span /> WHEN YOU’RE READY
          </p>
          <h2>
            Pick up
            <br />
            where <i>you are.</i>
          </h2>
        </div>
        <div className="landing-last-action">
          <p>
            Sign in to see your member details, or ask the gym staff if you need
            help accessing your account.
          </p>
          <Link className="landing-cta landing-cta-light" href="/login">
            Go to sign in <ArrowRight size={17} />
          </Link>
        </div>
        <span className="landing-last-orbit" aria-hidden="true" />
      </section>

      <footer className="landing-footer">
        <Link
          className="landing-brand"
          href="/"
          aria-label="Cordova Fit Hub home"
        >
          <span className="landing-brand-mark">
            <Dumbbell size={18} />
          </span>
          <span className="landing-brand-name">
            CORDOVA <b>FIT HUB</b>
          </span>
        </Link>
        <div className="landing-image-credits">
          <p>
            Illustrative photography only; images do not depict Cordova Fit
            Hub’s actual facilities.
          </p>
          <p>
            “Gym workout machine” by Samson Ssemakadde via{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Gym_workout_machine.jpg"
              target="_blank"
              rel="noreferrer"
            >
              Wikimedia Commons
            </a>{" "}
            (CC0).
          </p>
          <p>
            “Individual preparing for a workout” — photo by Nenad Stojković,
            uploaded by Shixart1985 via{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Individual_preparing_for_a_workout_in_a_modern_gym_environment.jpg"
              target="_blank"
              rel="noreferrer"
            >
              Wikimedia Commons
            </a>
            , licensed{" "}
            <a
              href="https://creativecommons.org/licenses/by/2.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 2.0
            </a>
            . Resized, compressed, and cropped for display.
          </p>
        </div>
        <Link className="landing-footer-signin" href="/login">
          Member & staff sign in <ArrowUpRight size={14} />
        </Link>
      </footer>
    </main>
  );
}
