package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "strconv"
    "strings"
)

/*
 * Complete the 'daysUntilWarmer' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY temperatures as parameter.
 */

func daysUntilWarmer(temperatures []int32) []int32 {
    n := len(temperatures)
    answer := make([]int32, n)
    // Days still waiting for a warmer reading. Their readings never rise from
    // the bottom of the stack to the top, so a new reading settles them from the top.
    waiting := make([]int, 0, n)
    for i, t := range temperatures {
        for len(waiting) > 0 && temperatures[waiting[len(waiting)-1]] < t {
            j := waiting[len(waiting)-1]
            waiting = waiting[:len(waiting)-1]
            answer[j] = int32(i - j)
        }
        waiting = append(waiting, i)
    }
    return answer
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    nTemp, err := strconv.ParseInt(strings.TrimSpace(readLine(reader)), 10, 64)
    checkError(err)
    n := int32(nTemp)

    temperaturesTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var temperatures []int32

    for i := 0; i < int(n); i++ {
        temperaturesItemTemp, err := strconv.ParseInt(temperaturesTemp[i], 10, 64)
        checkError(err)
        temperaturesItem := int32(temperaturesItemTemp)
        temperatures = append(temperatures, temperaturesItem)
    }

    result := daysUntilWarmer(temperatures)

    for i, resultItem := range result {
        fmt.Fprintf(writer, "%d", resultItem)

        if i != len(result) - 1 {
            fmt.Fprintf(writer, " ")
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
