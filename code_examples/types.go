package main

import "fmt"

type Person struct {
	Name string
	Age  int
}

func main() {
	// Tip: place breakpoints and enter debug mode to inspect variables during runtime
	var a int = -42
	var b uint = 1000
	var c float64 = 3.14
	var d bool = true
	var e string = "hello"
	var f rune = 'λ'
	var g byte = 0xFF

	arr := [3]int{1, 2, 3}
	sl1 := []string{"foo", "bar"}
	sl2 := make([]int, 5)
	sl3 := make([]int, 5, 10)

	m1 := map[string]int{"x": 10, "y": 20}
	m2 := make(map[int]string)

	s1 := Person{"Alice", 30}
	s2 := struct {
		Language string
		Year     int
	}{"Go", 2009}

	ptr := &a
	var ptrNil *int

	fn := func(x int) int {
		return x * x
	}

	ch1 := make(chan int)
	ch2 := make(chan string, 3)

	var if1 interface{}
	if1 = a
	if1 = map[string]interface{}{"b": b, "c": c, "e": e, "f": f}
	var if2 any
	if2 = d
	if2 = map[string]any{"s1": s1, "s2": s2, "m1": m1, "m2": m2}

	c64 := complex64(1 + 2i)
	c128 := complex128(2 + 3i)

	type Var struct {
		Name  string
		Value any
	}
	variables := []Var{
		{"a", a},
		{"b", b},
		{"c", c},
		{"d", d},
		{"e", e},
		{"f", f},
		{"g", g},
		{"arr", arr},
		{"sl1", sl1},
		{"sl2", sl2},
		{"sl3", sl3},
		{"m1", m1},
		{"m2", m2},
		{"s1", s1},
		{"s2", s2},
		{"ptr", ptr},
		{"ptrNil", ptrNil},
		{"fn", fn},
		{"ch1", ch1},
		{"ch2", ch2},
		{"if1", if1},
		{"if2", if2},
		{"c64", c64},
		{"c128", c128},
	}

	for _, v := range variables {
		fmt.Printf("%s (%T): %v\n", v.Name, v.Value, v.Value)
	}

	fmt.Println("--- Done! ---")
}
