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
 * Complete the 'minMeetingRooms' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts 2D_INTEGER_ARRAY meetings as parameter.
 */

func minMeetingRooms(meetings [][]int32) int32 {
    // Write your code here
    return 0
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    nTemp, err := strconv.ParseInt(strings.TrimSpace(readLine(reader)), 10, 64)
    checkError(err)
    n := int32(nTemp)

    var meetings [][]int32
    for i := 0; i < int(n); i++ {
        meetingsRowTemp := strings.Split(strings.TrimRight(readLine(reader), " \t\r\n"), " ")

        var meetingsRow []int32
        for _, meetingsRowItem := range meetingsRowTemp {
            meetingsItemTemp, err := strconv.ParseInt(meetingsRowItem, 10, 64)
            checkError(err)
            meetingsItem := int32(meetingsItemTemp)
            meetingsRow = append(meetingsRow, meetingsItem)
        }

        if len(meetingsRow) != 2 {
            panic("Bad input")
        }

        meetings = append(meetings, meetingsRow)
    }

    result := minMeetingRooms(meetings)

    fmt.Printf("%d\n", result)
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
