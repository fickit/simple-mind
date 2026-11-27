// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ImageSizeCache, imageDisplayBox } from "./imageSizes";

/** Minimal image stand-in that lets a test drive load and error events. */
function fakeImage(): HTMLImageElement & {
  triggerLoad: (width: number, height: number) => void;
  triggerError: () => void;
} {
  const image = {
    naturalWidth: 0,
    naturalHeight: 0,
    onload: null as null | (() => void),
    onerror: null as null | (() => void),
    set src(_value: string) {},
    triggerLoad(width: number, height: number) {
      image.naturalWidth = width;
      image.naturalHeight = height;
      image.onload?.();
    },
    triggerError() {
      image.onerror?.();
    },
  };
  return image as unknown as HTMLImageElement & {
    triggerLoad: (width: number, height: number) => void;
    triggerError: () => void;
  };
}

describe("imageDisplayBox", () => {
  it("caps unknown images at the placeholder box", () => {
    expect(imageDisplayBox(null, null)).toEqual({ width: 200, height: 120 });
    expect(imageDisplayBox(null, 300, 400)).toEqual({ width: 300, height: 180 });
  });

  it("caps natural images at 140 px high and keeps the ratio", () => {
    expect(imageDisplayBox({ width: 600, height: 300 }, null)).toEqual({
      width: 280,
      height: 140,
    });
    expect(imageDisplayBox({ width: 100, height: 50 }, null)).toEqual({
      width: 100,
      height: 50,
    });
  });

  it("honours a requested width and the node width cap", () => {
    expect(imageDisplayBox({ width: 600, height: 300 }, 300, 400)).toEqual({
      width: 300,
      height: 150,
    });
    expect(imageDisplayBox({ width: 600, height: 300 }, 900, 400)).toEqual({
      width: 400,
      height: 200,
    });
  });

  it("scales a wide image down to the width cap", () => {
    expect(imageDisplayBox({ width: 600, height: 300 }, null, 200)).toEqual({
      width: 200,
      height: 100,
    });
  });
});

describe("ImageSizeCache", () => {
  it("caches loaded sizes and calls every waiter once", () => {
    const image = fakeImage();
    const cache = new ImageSizeCache(() => image);
    const first = vi.fn();
    const second = vi.fn();

    expect(cache.size("app://a.png")).toBeNull();
    cache.request("app://a.png", first);
    cache.request("app://a.png", second);
    expect(cache.size("app://a.png")).toBeNull();

    image.triggerLoad(640, 480);

    expect(cache.size("app://a.png")).toEqual({ width: 640, height: 480 });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("caches failures as a 0×0 box", () => {
    const image = fakeImage();
    const cache = new ImageSizeCache(() => image);
    const ready = vi.fn();

    cache.request("app://broken.png", ready);
    image.triggerError();

    expect(cache.size("app://broken.png")).toEqual({ width: 0, height: 0 });
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it("does not load a known source twice", () => {
    const image = fakeImage();
    const create = vi.fn(() => image);
    const cache = new ImageSizeCache(create);

    cache.request("app://a.png", vi.fn());
    image.triggerLoad(10, 10);
    cache.request("app://a.png", vi.fn());

    expect(create).toHaveBeenCalledTimes(1);
  });
});
