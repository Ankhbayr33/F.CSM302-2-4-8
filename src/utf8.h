/*
 * utf8.h - minimal UTF-8 helpers (task names may contain Cyrillic letters)
 */
#ifndef UTF8_H
#define UTF8_H

/* Decode one UTF-8 character at s. Stores the code point in *cp and
 * returns the number of bytes used (1-4), or -1 for an invalid sequence. */
int utf8_decode(const char *s, unsigned *cp);

/* Number of characters (code points) in a valid UTF-8 string; used as the
 * display width when aligning names in the text output. */
int utf8_width(const char *s);

/* 1 if s starts with the UTF-8 byte order mark EF BB BF. */
int utf8_has_bom(const char *s);

#endif /* UTF8_H */
