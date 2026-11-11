/*
 * utf8.c - minimal UTF-8 helpers
 */
#include "utf8.h"

static int is_cont(unsigned char c) { return (c & 0xC0) == 0x80; }

int utf8_decode(const char *str, unsigned *cp)
{
    const unsigned char *s = (const unsigned char *)str;

    if (s[0] < 0x80) {                                   /* ASCII */
        *cp = s[0];
        return 1;
    }
    if (s[0] >= 0xC2 && s[0] <= 0xDF && is_cont(s[1])) { /* 2 bytes */
        *cp = ((unsigned)(s[0] & 0x1F) << 6) | (s[1] & 0x3F);
        return 2;
    }
    if (s[0] >= 0xE0 && s[0] <= 0xEF && is_cont(s[1]) && is_cont(s[2])) {
        unsigned v = ((unsigned)(s[0] & 0x0F) << 12)
                   | ((unsigned)(s[1] & 0x3F) << 6) | (s[2] & 0x3F);
        if (v < 0x800 || (v >= 0xD800 && v <= 0xDFFF))   /* overlong, surrogate */
            return -1;
        *cp = v;
        return 3;
    }
    if (s[0] >= 0xF0 && s[0] <= 0xF4 && is_cont(s[1]) && is_cont(s[2])
        && is_cont(s[3])) {
        unsigned v = ((unsigned)(s[0] & 0x07) << 18)
                   | ((unsigned)(s[1] & 0x3F) << 12)
                   | ((unsigned)(s[2] & 0x3F) << 6) | (s[3] & 0x3F);
        if (v < 0x10000 || v > 0x10FFFF)
            return -1;
        *cp = v;
        return 4;
    }
    return -1;
}

int utf8_width(const char *s)
{
    int n = 0;
    while (*s) {
        unsigned cp;
        int len = utf8_decode(s, &cp);
        s += len > 0 ? len : 1;      /* invalid byte counts as one column */
        n++;
    }
    return n;
}

int utf8_has_bom(const char *s)
{
    return (unsigned char)s[0] == 0xEF && (unsigned char)s[1] == 0xBB
        && (unsigned char)s[2] == 0xBF;
}
