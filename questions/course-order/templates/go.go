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
 * Complete the 'courseOrder' function below.
 *
 * The function is expected to return a STRING.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY prerequisites
 */

func courseOrder(n int32, prerequisites [][]int32) string {
    // Write your code here
    return ""
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    mTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    m := int32(mTemp)

    var prerequisites [][]int32
    for i := 0; i < int(m); i++ {
        prerequisitesRowTemp := strings.Split(strings.TrimRight(readLine(reader), " \t\r\n"), " ")

        var prerequisitesRow []int32
        for _, prerequisitesRowItem := range prerequisitesRowTemp {
            prerequisitesItemTemp, err := strconv.ParseInt(prerequisitesRowItem, 10, 64)
            checkError(err)
            prerequisitesItem := int32(prerequisitesItemTemp)
            prerequisitesRow = append(prerequisitesRow, prerequisitesItem)
        }

        if len(prerequisitesRow) != 2 {
            panic("Bad input")
        }

        prerequisites = append(prerequisites, prerequisitesRow)
    }

    result := courseOrder(n, prerequisites)

    fmt.Printf("%s\n", result)
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
