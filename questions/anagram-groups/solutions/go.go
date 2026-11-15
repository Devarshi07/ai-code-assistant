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
 * Complete the 'anagramGroups' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts STRING_ARRAY words as parameter.
 */

func anagramGroups(words []string) []int32 {
    groups := make(map[string]int32, len(words))
    var largest int32
    for _, word := range words {
        letters := []byte(word)
        sort.Slice(letters, func(i, j int) bool { return letters[i] < letters[j] })
        key := string(letters)
        groups[key]++
        if groups[key] > largest {
            largest = groups[key]
        }
    }
    return []int32{int32(len(groups)), largest}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    nTemp, err := strconv.ParseInt(strings.TrimSpace(readLine(reader)), 10, 64)
    checkError(err)
    n := int32(nTemp)

    var words []string

    for i := 0; i < int(n); i++ {
        wordsItem := strings.TrimSpace(readLine(reader))
        words = append(words, wordsItem)
    }

    result := anagramGroups(words)

    for i, resultItem := range result {
        fmt.Printf("%d", resultItem)

        if i != len(result) - 1 {
            fmt.Printf(" ")
        }
    }

    fmt.Printf("\n")
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
