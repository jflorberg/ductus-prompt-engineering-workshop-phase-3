import { useState, type ReactNode } from "react";
import { ClapLogin } from "./ClapLogin";
import { isLoggedIn, logIn, logOut } from "./identity";

/** Shows the clap login until the user is in, then the app with a Log out button below it. */
export function ClapGate({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);

  if (!loggedIn) {
    return (
      <ClapLogin
        onLogIn={() => {
          logIn();
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <>
      {children}
      <footer className="logout">
        <button
          type="button"
          onClick={() => {
            logOut();
            setLoggedIn(false);
          }}
        >
          <span className="emoji" aria-hidden="true">
            👋
          </span>
          Log out
        </button>
      </footer>
    </>
  );
}
