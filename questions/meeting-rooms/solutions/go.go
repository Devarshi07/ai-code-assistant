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
 * Complete the 'minMeetingRooms' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts 2D_INTEGER_ARRAY meetings as parameter.
 */

func minMeetingRooms(meetings [][]int32) int32 {
    n := len(meetings)
    starts := make([]int32, n)
    ends := make([]int32, n)
    for i, meeting := range meetings {
        starts[i], ends[i] = meeting[0], meeting[1]
    }
    sort.Slice(starts, func(i, j int) bool { return starts[i] < starts[j] })
    sort.Slice(ends, func(i, j int) bool { return ends[i] < ends[j] })
    // Walk the starts in order. A meeting starting at or after the earliest
    // end time not yet reused can take that room; otherwise it needs a new one.
    var rooms int32
    j := 0
    for i := 0; i < n; i++ {
        if starts[i] < ends[j] {
            rooms++
        } else {
            j++
        }
    }
    return rooms
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
