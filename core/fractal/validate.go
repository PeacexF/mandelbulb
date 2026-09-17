package fractal

import "fmt"

// Validate reports whether the parameter set is usable for distance
// estimation and rendering.
func (m Mandelbulb) Validate() error {
	if m.Power < 1 {
		return fmt.Errorf("fractal: power must be >= 1, got %v", m.Power)
	}
	if m.Iterations < 1 {
		return fmt.Errorf("fractal: iterations must be >= 1, got %v", m.Iterations)
	}
	if m.Bailout <= 0 {
		return fmt.Errorf("fractal: bailout must be > 0, got %v", m.Bailout)
	}
	return nil
}
