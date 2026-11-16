package com.debuggym.api.controller;

import com.debuggym.api.dto.CreateSpaceRequest;
import com.debuggym.api.model.Space;
import com.debuggym.api.service.SpaceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/spaces")
public class SpaceController {
    private final SpaceService service;

    public SpaceController(SpaceService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<Space> create(@Valid @RequestBody CreateSpaceRequest request) {
        Space space = service.create(request);
        return ResponseEntity.created(URI.create("/spaces/" + space.id())).body(space);
    }

    @GetMapping
    public List<Space> list() {
        return service.list();
    }
}
