package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "sort"
    "strconv"
    "strings"
)

/*
 * Complete the 'topWords' function below.
 *
 * The function is expected to return a STRING_ARRAY.
 * The function accepts following parameters:
 *  1. STRING_ARRAY lines
 *  2. INTEGER k
 */

func topWords(lines []string, k int32) []string {
    counts := make(map[string]int)
    for _, line := range lines {
        for _, word := range strings.Fields(line) {
            counts[word]++
        }
    }
    words := make([]string, 0, len(counts))
    for word := range counts {
        words = append(words, word)
    }
    sort.Slice(words, func(i, j int) bool {
        if counts[words[i]] != counts[words[j]] {
            return counts[words[i]] > counts[words[j]]
        }
        return words[i] < words[j]
    })
    if int(k) < len(words) {
        words = words[:k]
    }
    result := make([]string, len(words))
    for i, word := range words {
        result[i] = word + " " + strconv.Itoa(counts[word])
    }
    return result
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    mTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    m := int32(mTemp)

    kTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    k := int32(kTemp)

    var lines []string

    for i := 0; i < int(m); i++ {
        linesItem := strings.TrimSpace(readLine(reader))
        lines = append(lines, linesItem)
    }

    result := topWords(lines, k)

    for i, resultItem := range result {
        fmt.Fprintf(writer, "%s", resultItem)

        if i != len(result) - 1 {
            fmt.Fprintf(writer, "\n")
        }
    }

    fmt.Fprintf(writer, "\n")

    writer.Flush()
}

func readLine(reader *bufio.Reader) string {
    str, _, err := reader.ReadLine()
    if err == io.EOF {
        return ""
    }

    return strings.TrimRight(string(str), "\r\n")
}

func checkError(err error) {
    if err != nil {
        panic(err)
    }
}
