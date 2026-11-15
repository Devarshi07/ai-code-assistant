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
 * Complete the 'minimumEditCost' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. STRING a
 *  2. STRING b
 *  3. INTEGER insertCost
 *  4. INTEGER deleteCost
 *  5. INTEGER replaceCost
 */

func minimumEditCost(a string, b string, insertCost int32, deleteCost int32, replaceCost int32) int64 {
    // Write your code here
    return 0
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    a := strings.TrimSpace(readLine(reader))

    b := strings.TrimSpace(readLine(reader))

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    insertCostTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    insertCost := int32(insertCostTemp)

    deleteCostTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    deleteCost := int32(deleteCostTemp)

    replaceCostTemp, err := strconv.ParseInt(firstMultipleInput[2], 10, 64)
    checkError(err)
    replaceCost := int32(replaceCostTemp)

    result := minimumEditCost(a, b, insertCost, deleteCost, replaceCost)

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
