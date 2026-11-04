import { describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import {
  createSwipeService,
  TRENDING_LIMIT,
  TRENDING_MIN_SWIPES,
  UnknownMemeError,
} from "../src/swipes/service.js";

const MINUTE = 60 * 1000;

/** A service with memes a..l and a clock the test moves forward by hand. */
function setup() {
  const ids = "abcdefghijkl".split("");
  const catalog = createMemeCatalog(ids.map((id) => ({ id, caption: id, file: `${id}.svg` })));
  let time = Date.parse("2026-11-04T12:00:00.000Z");
  const service = createSwipeService(
    catalog,
    createInMemorySwipeRepository(),
    () => new Date(time),
  );
  return {
    service,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("swipe timestamps", () => {
  it("stamps each swipe with the current time", () => {
    const { service } = setup();
    expect(service.recordSwipe("u1", "a", "like").swipedAt).toBe("2026-11-04T12:00:00.000Z");
  });
});

describe("meme stats", () => {
  it("has no love percent before anyone swiped", () => {
    expect(setup().service.getMemeStats("a")).toEqual({ likes: 0, nopes: 0, lovePercent: null });
  });

  it("counts likes and nopes from all users", () => {
    const { service } = setup();
    service.recordSwipe("u1", "a", "like");
    service.recordSwipe("u2", "a", "like");
    service.recordSwipe("u3", "a", "nope");
    service.recordSwipe("u1", "b", "nope");

    expect(service.getMemeStats("a")).toEqual({ likes: 2, nopes: 1, lovePercent: 67 });
    expect(service.getMemeStats("b")).toEqual({ likes: 0, nopes: 1, lovePercent: 0 });
  });

  it("does not count a repeated swipe twice", () => {
    const { service } = setup();
    service.recordSwipe("u1", "a", "like");
    service.recordSwipe("u1", "a", "nope");

    expect(service.getMemeStats("a")).toEqual({ likes: 1, nopes: 0, lovePercent: 100 });
  });

  it("drops a user's swipes from the stats on reset", () => {
    const { service } = setup();
    service.recordSwipe("u1", "a", "like");
    service.recordSwipe("u2", "a", "nope");
    service.resetSwipes("u1");

    expect(service.getMemeStats("a")).toEqual({ likes: 0, nopes: 1, lovePercent: 0 });
  });

  it("throws for an unknown meme", () => {
    expect(() => setup().service.getMemeStats("nope")).toThrow(UnknownMemeError);
  });
});

describe("trending", () => {
  it("is empty when nobody has liked anything", () => {
    const { service } = setup();
    service.recordSwipe("u1", "a", "nope");

    expect(service.getTrending()).toEqual({ window: "all", memes: [] });
  });

  it("ranks by likes, then love percent, then catalog order", () => {
    const { service } = setup();
    // c: 2 likes. b: 1 like 0 nopes (100%). a: 1 like 1 nope (50%). d: 1 like (100%), after b.
    service.recordSwipe("u1", "c", "like");
    service.recordSwipe("u2", "c", "like");
    service.recordSwipe("u1", "a", "like");
    service.recordSwipe("u2", "a", "nope");
    service.recordSwipe("u1", "d", "like");
    service.recordSwipe("u1", "b", "like");

    const { window, memes } = service.getTrending();

    expect(window).toBe("hour");
    expect(memes.map((entry) => entry.meme.id)).toEqual(["c", "b", "d", "a"]);
    expect(memes[0]).toMatchObject({ likes: 2, nopes: 0, lovePercent: 100 });
  });

  it("only counts the last hour when it is busy enough", () => {
    const { service, advance } = setup();
    // An hour ago, "a" was the hit...
    for (const user of ["u1", "u2", "u3"]) service.recordSwipe(user, "a", "like");
    advance(61 * MINUTE);
    // ...now "b" is.
    for (let i = 0; i < TRENDING_MIN_SWIPES; i++) service.recordSwipe(`v${i}`, "b", "like");

    expect(service.getTrending()).toMatchObject({
      window: "hour",
      memes: [{ meme: { id: "b" }, likes: TRENDING_MIN_SWIPES }],
    });
  });

  it("falls back to all time when the last hour is quiet", () => {
    const { service, advance } = setup();
    for (const user of ["u1", "u2", "u3"]) service.recordSwipe(user, "a", "like");
    advance(61 * MINUTE);
    service.recordSwipe("u4", "b", "like");

    const { window, memes } = service.getTrending();

    expect(window).toBe("all");
    expect(memes.map((entry) => entry.meme.id)).toEqual(["a", "b"]);
  });

  it(`shows at most ${TRENDING_LIMIT} memes`, () => {
    const { service } = setup();
    for (const id of "abcdefghijkl") service.recordSwipe("u1", id, "like");

    expect(service.getTrending().memes).toHaveLength(TRENDING_LIMIT);
  });
});

describe("memes per minute", () => {
  it("is 0 when nobody swiped", () => {
    expect(setup().service.getSwipesPerMinute()).toBe(0);
  });

  it("counts likes and nopes from all users in the last minute only", () => {
    const { service, advance } = setup();
    service.recordSwipe("u1", "a", "like");
    advance(30 * 1000);
    service.recordSwipe("u2", "a", "nope");
    service.recordSwipe("u1", "b", "like");

    expect(service.getSwipesPerMinute()).toBe(3);

    advance(31 * 1000); // the first swipe is now older than a minute
    expect(service.getSwipesPerMinute()).toBe(2);
  });
});
